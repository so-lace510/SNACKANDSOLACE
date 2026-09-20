import unittest

from fastapi.testclient import TestClient

from backend.main import app


class ContactApiContractTests(unittest.TestCase):
    def test_contact_accepts_legacy_full_name_payload(self):
        client = TestClient(app)
        response = client.post(
            "/api/contact",
            json={
                "full_name": "Jane Doe",
                "email": "jane@example.com",
                "subject": "Hello",
                "message": "Test message body",
            },
        )

        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()["status"], "sent")


if __name__ == "__main__":
    unittest.main()
