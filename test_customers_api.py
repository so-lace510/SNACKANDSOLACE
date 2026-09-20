import unittest

from fastapi.testclient import TestClient

from backend.main import ADMIN_API_KEY, app


class CustomerApiTests(unittest.TestCase):
    def test_storefront_has_only_the_four_homepage_products(self):
        client = TestClient(app)
        response = client.get("/api/products")
        self.assertEqual(response.status_code, 200, response.text)
        products = response.json()
        self.assertEqual(len(products), 4)
        self.assertEqual([item["category"] for item in products], ["Chin-Chin", "Cookies", "Bread", "Fruit Juice"])

    def test_order_creates_customer_record_and_customer_list_is_available(self):
        client = TestClient(app)
        payload = {
            "full_name": "Ada Okafor",
            "phone": "08012345678",
            "email": "ada.customer@example.com",
            "address": "12 Market Road, Lagos",
            "payment_method": "paystack",
            "items": [{"id": "cc1", "quantity": 2}],
        }

        order_response = client.post("/api/orders", json=payload)
        self.assertEqual(order_response.status_code, 201, order_response.text)

        customers_response = client.get(
            "/api/customers",
            headers={"X-Admin-Key": ADMIN_API_KEY},
        )
        self.assertEqual(customers_response.status_code, 200, customers_response.text)
        customer_data = customers_response.json()
        self.assertTrue(any(item["email"] == payload["email"] for item in customer_data))


if __name__ == "__main__":
    unittest.main()
