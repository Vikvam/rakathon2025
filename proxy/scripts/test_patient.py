from httpx import Client

# url = "http://localhost:8000"
url = "https://rakathon-proxy.manakjiri.cz"
client = Client(base_url=url)

response = client.post("/patient", json={"message_type": "patient_session_query", "code": "709346"})
print(response.json())
