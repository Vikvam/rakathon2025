from httpx import Client

client = Client(base_url="http://localhost:8000")

response = client.post("/patient", json={"message_type": "patient_session_query", "code": "123456"})
print(response.json())
