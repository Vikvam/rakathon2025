import json

from websockets.sync.client import connect

data = {
    "some": "dummy data",
    "some_other": "dummy data 2",
    "questionare": {
        "question": "What is your name?",
    },
}


with connect("ws://localhost:8000/doctor") as ws:
    ws.send(json.dumps({"message_type": "doctor_session_init", "code": "123456"}))
    print("Waiting for patient connection")
    query = ws.recv()
    print("Patient connected", query, "sending response")
    ws.send(json.dumps({"message_type": "doctor_session_response", "data": data}))
