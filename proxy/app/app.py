from fastapi import FastAPI, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.manager import ConnectionManager
from app.schemas import PatientSessionQuery, PatientSessionResponse

app = FastAPI()
manager = ConnectionManager()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)


@app.post("/patient")
async def patient_get_data(request: Request):
    query = PatientSessionQuery.model_validate(await request.json())
    doctor_response = await manager.get_data_by_code(query.code)
    return PatientSessionResponse.from_doctor_response(doctor_response)


@app.websocket("/doctor")
async def doctor_start_new_proxy_request(websocket: WebSocket):
    await manager.connect(websocket)
