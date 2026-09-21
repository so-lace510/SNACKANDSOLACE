import os
import json
import re
import sqlite3
import smtplib
import uuid
from email.message import EmailMessage
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field, model_validator
from supabase import Client, create_client

load_dotenv(Path(__file__).with_name(".env"), override=True)

DATABASE_PATH = Path(__file__).with_name("orders.db")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY")
PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY")
PAYSTACK_PUBLIC_KEY = os.getenv("PAYSTACK_PUBLIC_KEY")
PAYSTACK_BASE_URL = os.getenv("PAYSTACK_BASE_URL", "https://api.paystack.co")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
PAYSTACK_CALLBACK_URL = os.getenv("PAYSTACK_CALLBACK_URL", f"{FRONTEND_URL}/checkout")
ALLOWED_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv("ALLOWED_ORIGINS", f"{FRONTEND_URL},http://localhost:5173,http://127.0.0.1:5173").split(",")
    if origin.strip()
]
supabase: Client | None = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

app = FastAPI(title="SNACKANDSOLACE API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PRODUCTS = [
    {"id": "cc1", "name": "Chin-Chin", "category": "Chin-Chin", "weight": "500g pack", "price": 1000},
    {"id": "ck1", "name": "Cookies", "category": "Cookies", "weight": "12-pack", "price": 2000},
    {"id": "br1", "name": "Bread", "category": "Bread", "weight": "800g loaf", "price": 1500},
    {"id": "fj1", "name": "Fruit Juice", "category": "Fruit Juice", "weight": "1 litre", "price": 1000},
]


class CartItem(BaseModel):
    id: str
    quantity: int = Field(gt=0)


class OrderRequest(BaseModel):
    full_name: str = Field(min_length=2)
    phone: str = Field(min_length=7)
    email: EmailStr
    address: str = ""
    payment_method: Literal["card", "transfer", "paystack"]
    fulfillment_method: Literal["delivery", "pickup"] = "delivery"
    delivery_fee: int = Field(default=0, ge=0)
    items: list[CartItem] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_fulfillment_details(self):
        if self.fulfillment_method == "delivery" and len(self.address.strip()) < 5:
            raise ValueError("A delivery address is required for delivery orders")
        return self


class PaystackVerifyResponse(BaseModel):
    reference: str


class ContactRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2)
    full_name: str | None = Field(default=None, min_length=2)
    email: EmailStr
    subject: str = Field(min_length=2)
    message: str = Field(min_length=5)

    @model_validator(mode="before")
    @classmethod
    def normalize_name(cls, values):
        if isinstance(values, dict) and "name" not in values and values.get("full_name"):
            values = {**values, "name": values["full_name"]}
        return values

    @property
    def contact_name(self) -> str:
        return (self.name or self.full_name or "").strip()


class ReviewRequest(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    rating: int = Field(ge=1, le=5)
    message: str = Field(min_length=5, max_length=500)


class OrderStatusUpdate(BaseModel):
    status: Literal["received", "preparing", "shipped", "delivered"]


def get_database_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database() -> None:
    with get_database_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                full_name TEXT NOT NULL,
                phone TEXT NOT NULL,
                email TEXT NOT NULL,
                address TEXT NOT NULL,
                payment_method TEXT NOT NULL,
                items TEXT NOT NULL,
                total INTEGER NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS customers (
                id TEXT PRIMARY KEY,
                full_name TEXT NOT NULL,
                phone TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                address TEXT NOT NULL,
                created_at TEXT NOT NULL,
                last_order_at TEXT NOT NULL,
                order_count INTEGER NOT NULL DEFAULT 0,
                total_spent INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS reviews (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
                message TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )


initialize_database()


def upsert_customer_record(order: OrderRequest, total: int) -> dict:
    customer_record = {
        "id": f"CUST-{uuid.uuid4().hex[:8].upper()}",
        "full_name": order.full_name,
        "phone": order.phone,
        "email": str(order.email),
        "address": order.address,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_order_at": datetime.now(timezone.utc).isoformat(),
        "order_count": 1,
        "total_spent": total,
    }

    if supabase:
        try:
            existing = (
                supabase.table("customers")
                .select("id, order_count, total_spent, created_at, last_order_at")
                .eq("email", customer_record["email"])
                .limit(1)
                .execute()
            )
            if existing.data:
                row = existing.data[0]
                customer_record["id"] = row["id"]
                customer_record["created_at"] = row["created_at"]
                customer_record["order_count"] = int(row.get("order_count", 0)) + 1
                customer_record["total_spent"] = int(row.get("total_spent", 0)) + total
                customer_record["last_order_at"] = datetime.now(timezone.utc).isoformat()
            supabase.table("customers").upsert(customer_record, on_conflict="email").execute()
            return customer_record
        except Exception:
            pass

    with get_database_connection() as connection:
        existing = connection.execute(
            "SELECT created_at, order_count, total_spent FROM customers WHERE email = ?",
            (customer_record["email"],),
        ).fetchone()
        if existing:
            customer_record["id"] = customer_record["id"] or str(uuid.uuid4())
            customer_record["created_at"] = existing["created_at"]
            customer_record["order_count"] = int(existing["order_count"]) + 1
            customer_record["total_spent"] = int(existing["total_spent"]) + total

        connection.execute(
            """
            INSERT INTO customers
                (id, full_name, phone, email, address, created_at, last_order_at, order_count, total_spent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET
                full_name = excluded.full_name,
                phone = excluded.phone,
                address = excluded.address,
                last_order_at = excluded.last_order_at,
                order_count = customers.order_count + 1,
                total_spent = customers.total_spent + excluded.total_spent
            """,
            (
                customer_record["id"],
                customer_record["full_name"],
                customer_record["phone"],
                customer_record["email"],
                customer_record["address"],
                customer_record["created_at"],
                customer_record["last_order_at"],
                customer_record["order_count"],
                customer_record["total_spent"],
            ),
        )

    return customer_record


def get_paystack_headers() -> dict[str, str]:
    if not PAYSTACK_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Paystack secret key is not configured")
    return {
        "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json",
    }


def calculate_delivery_fee(address: str) -> int:
    normalized = address.strip().lower()
    if not normalized:
        return 0

    zones = [
        (r"\b(uk|united kingdom|usa|united states|america|canada|europe|france|germany|dubai|uae|saudi|qatar|london|new york|toronto|paris|berlin|abroad)\b", 45000),
        (r"\b(lagos|ikeja|lekki|surulere|yaba|ajah|victoria island|abuja|kubwa|gwarinpa|ibadan|abeokuta|enugu|owerri|aba|asaba|benin|warri|kaduna|kano|jos|katsina|sokoto|kogi|calabar|uyo|akwa ibom|bayelsa|delta|edo|onitsha|nnewi)\b", 9000),
        (r"\b(woji|choba|aluu|ozuoba|eneka|oroazi|trans-amadi|eliozu|rumuodomaya|mini|oyigbo|eleme|bonny|obio|obio[/-]akpor|akpor)\b", 2500),
        (r"\b(rumuewhara|rumuola|rumuomasi|diobu|port harcourt|phc|p\.h\.c|old gra|new gra|g\.r\.a|gra|mgbuoba|ada george|ogbunabali|d-line|dline|rivers state|rivers)\b", 1500),
    ]

    for pattern, fee in zones:
        if re.search(pattern, normalized, re.IGNORECASE):
            return fee
    return 3000


def calculate_order_total(order: OrderRequest) -> int:
    product_map = {product["id"]: product for product in PRODUCTS}
    total = 0
    for item in order.items:
        product = product_map.get(item.id)
        if product is None:
            raise HTTPException(status_code=400, detail=f"Unknown product: {item.id}")
        total += product["price"] * item.quantity
    return total + (calculate_delivery_fee(order.address) if order.fulfillment_method == "delivery" else 0)


def send_contact_email(contact: ContactRequest) -> None:
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_use_ssl = os.getenv("SMTP_USE_SSL", "false").lower() == "true"
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    recipient = os.getenv("CONTACT_RECIPIENT", smtp_username or "")

    if not smtp_username or not smtp_password or not recipient:
        raise RuntimeError("Email settings are missing")

    email = EmailMessage()
    email["Subject"] = f"SNACKANDSOLACE contact: {contact.subject}"
    email["From"] = smtp_username
    email["To"] = recipient
    email["Reply-To"] = contact.email
    email.set_content(
        f"Name: {contact.contact_name}\n"
        f"Email: {contact.email}\n"
        f"Subject: {contact.subject}\n\n"
        f"{contact.message}"
    )

    server_class = smtplib.SMTP_SSL if smtp_use_ssl else smtplib.SMTP
    with server_class(smtp_host, smtp_port, timeout=15) as server:
        if not smtp_use_ssl:
            server.starttls()
        server.login(smtp_username, smtp_password)
        server.send_message(email)


def send_pickup_email(order: OrderRequest) -> None:
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_use_ssl = os.getenv("SMTP_USE_SSL", "false").lower() == "true"
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")

    if not smtp_username or not smtp_password:
        raise RuntimeError("Email settings are missing")

    email = EmailMessage()
    email["Subject"] = "Your SNACKANDSOLACE pickup details"
    email["From"] = smtp_username
    email["To"] = str(order.email)
    email.set_content(
        f"Hello {order.full_name},\n\n"
        "Your SNACKANDSOLACE order has been received for pickup.\n\n"
        "Pickup address:\n"
        "13 Nyejelem close, Rumuewhara, Portharcourt, Nigeria\n\n"
        "We will contact you when your order is ready.\n\n"
        "Thank you,\nSNACKANDSOLACE"
    )

    server_class = smtplib.SMTP_SSL if smtp_use_ssl else smtplib.SMTP
    with server_class(smtp_host, smtp_port, timeout=15) as server:
        if not smtp_use_ssl:
            server.starttls()
        server.login(smtp_username, smtp_password)
        server.send_message(email)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "snackandsolace"}


@app.get("/")
def root():
    return {
        "service": "SNACKANDSOLACE API",
        "status": "running",
        "docs": "/docs",
        "health": "/api/health",
    }


@app.get("/api/products")
def get_products():
    return PRODUCTS


@app.get("/api/reviews")
def get_reviews():
    with get_database_connection() as connection:
        rows = connection.execute(
            "SELECT id, name, rating, message, created_at FROM reviews ORDER BY created_at DESC"
        ).fetchall()
    return [dict(row) for row in rows]


@app.post("/api/reviews", status_code=201)
def create_review(review: ReviewRequest):
    review_record = {
        "id": f"REV-{uuid.uuid4().hex[:10].upper()}",
        "name": review.name.strip(),
        "rating": review.rating,
        "message": review.message.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    with get_database_connection() as connection:
        connection.execute(
            "INSERT INTO reviews (id, name, rating, message, created_at) VALUES (?, ?, ?, ?, ?)",
            tuple(review_record.values()),
        )
    return review_record


@app.post("/api/orders", status_code=201)
def create_order(order: OrderRequest):
    total = calculate_order_total(order)

    order_id = f"SNS-{uuid.uuid4().hex[:8].upper()}"
    created_at = datetime.now(timezone.utc).isoformat()
    order_record = {
        "id": order_id,
        "full_name": order.full_name,
        "phone": order.phone,
        "email": str(order.email),
        "address": order.address,
        "payment_method": order.payment_method,
        "items": [item.model_dump() for item in order.items],
        "total": total,
        "status": "received",
        "created_at": created_at,
    }
    if supabase:
        try:
            supabase.table("orders").insert(order_record).execute()
        except Exception:
            with get_database_connection() as connection:
                connection.execute(
                    """
                    INSERT INTO orders
                        (id, full_name, phone, email, address, payment_method, items, total, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        order_id,
                        order.full_name,
                        order.phone,
                        str(order.email),
                        order.address,
                        order.payment_method,
                        json.dumps(order_record["items"]),
                        total,
                        "received",
                        created_at,
                    ),
                )
    else:
        with get_database_connection() as connection:
            connection.execute(
                """
                INSERT INTO orders
                    (id, full_name, phone, email, address, payment_method, items, total, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    order_id,
                    order.full_name,
                    order.phone,
                    str(order.email),
                    order.address,
                    order.payment_method,
                    json.dumps(order_record["items"]),
                    total,
                    "received",
                    created_at,
                ),
            )

    upsert_customer_record(order, total)

    if order.fulfillment_method == "pickup":
        try:
            send_pickup_email(order)
        except Exception:
            pass

    return {
        "order_id": order_id,
        "status": "received",
        "customer": order.full_name,
        "total": total,
    }


@app.post("/api/paystack/initialize")
def initialize_paystack_payment(order: OrderRequest):
    if not PAYSTACK_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Paystack secret key is not configured")

    total = calculate_order_total(order)
    reference = f"SNS-{uuid.uuid4().hex[:10].upper()}"

    payload = {
        "email": str(order.email),
        "amount": total * 100,
        "currency": "NGN",
        "reference": reference,
        "callback_url": PAYSTACK_CALLBACK_URL,
        "metadata": {
            "full_name": order.full_name,
            "phone": order.phone,
            "address": order.address,
            "fulfillment_method": order.fulfillment_method,
            "items": [item.model_dump() for item in order.items],
        },
    }

    try:
        response = httpx.post(
            f"{PAYSTACK_BASE_URL}/transaction/initialize",
            headers=get_paystack_headers(),
            json=payload,
            timeout=20,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Unable to reach Paystack right now.") from exc

    try:
        data = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Paystack returned an invalid response.") from exc
    if response.status_code >= 400 or not data.get("status"):
        detail = data.get("message") or data.get("data", {}).get("message") or "Paystack initialization failed"
        raise HTTPException(status_code=400, detail=detail)

    return {
        "status": "initialized",
        "authorization_url": data["data"]["authorization_url"],
        "reference": reference,
        "amount": total,
    }


@app.get("/api/paystack/verify")
def verify_paystack_payment(reference: str):
    if not PAYSTACK_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Paystack secret key is not configured")

    try:
        response = httpx.get(
            f"{PAYSTACK_BASE_URL}/transaction/verify/{reference}",
            headers=get_paystack_headers(),
            timeout=20,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Unable to verify this Paystack payment.") from exc

    data = response.json()
    if response.status_code >= 400 or not data.get("status"):
        detail = data.get("message", "Payment verification failed")
        raise HTTPException(status_code=400, detail=detail)

    result = data["data"]
    return {
        "status": result.get("status"),
        "reference": result.get("reference"),
        "amount": result.get("amount", 0) / 100,
        "paid_at": result.get("paid_at"),
        "gateway_response": result.get("gateway_response"),
    }


@app.get("/api/customers")
def get_customers(x_admin_key: str | None = Header(default=None)):
    if not ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail="Admin API key is not configured")
    if x_admin_key != ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid admin API key")

    if supabase:
        try:
            response = supabase.table("customers").select("*").order("last_order_at", desc=True).execute()
            return response.data
        except Exception:
            pass

    with get_database_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM customers ORDER BY last_order_at DESC"
        ).fetchall()

    return [dict(row) for row in rows]


@app.get("/api/orders")
def get_orders(x_admin_key: str | None = Header(default=None)):
    if not ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail="Admin API key is not configured")
    if x_admin_key != ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid admin API key")

    if supabase:
        try:
            response = supabase.table("orders").select("*").order("created_at", desc=True).execute()
            return response.data
        except Exception:
            pass

    with get_database_connection() as connection:
        rows = connection.execute(
            "SELECT id, full_name, phone, email, address, payment_method, items, total, status, created_at FROM orders ORDER BY created_at DESC"
        ).fetchall()

    return [
        {
            **dict(row),
            "items": json.loads(row["items"]),
        }
        for row in rows
    ]


@app.patch("/api/orders/{order_id}")
def update_order_status(order_id: str, update: OrderStatusUpdate, x_admin_key: str | None = Header(default=None)):
    if not ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail="Admin API key is not configured")
    if x_admin_key != ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid admin API key")

    if supabase:
        response = supabase.table("orders").update({"status": update.status}).eq("id", order_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Order not found")
    else:
        with get_database_connection() as connection:
            result = connection.execute("UPDATE orders SET status = ? WHERE id = ?", (update.status, order_id))
            if result.rowcount == 0:
                raise HTTPException(status_code=404, detail="Order not found")

    return {"id": order_id, "status": update.status}


@app.post("/api/contact", status_code=201)
def submit_contact(message: ContactRequest):
    try:
        send_contact_email(message)
    except (OSError, smtplib.SMTPException, RuntimeError) as error:
        print(f"Contact email failed: {error}")
        return {
            "status": "sent",
            "message": "Thanks - your message has been sent. Email delivery will be enabled when SMTP is configured.",
        }

    return {"status": "sent", "message": "Thanks - your message has been sent."}
