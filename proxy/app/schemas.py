from enum import Enum
from typing import Literal

from pydantic import BaseModel


class MessageType(str, Enum):
    PATIENT_SESSION_QUERY = "patient_session_query"
    PATIENT_SESSION_RESPONSE = "patient_session_response"
    DOCTOR_SESSION_INIT = "doctor_session_init"
    DOCTOR_SESSION_PATIENT_CONNECTED = "doctor_session_patient_connected"
    DOCTOR_SESSION_RESPONSE = "doctor_session_response"


class DoctorSessionInit(BaseModel):
    message_type: Literal[MessageType.DOCTOR_SESSION_INIT] = MessageType.DOCTOR_SESSION_INIT
    code: int


class PatientSessionQuery(BaseModel):
    message_type: Literal[MessageType.PATIENT_SESSION_QUERY] = MessageType.PATIENT_SESSION_QUERY
    code: int


class DoctorSessionPatientConnected(BaseModel):
    message_type: Literal[MessageType.DOCTOR_SESSION_PATIENT_CONNECTED] = MessageType.DOCTOR_SESSION_PATIENT_CONNECTED


class DoctorSessionResponse(BaseModel):
    message_type: Literal[MessageType.DOCTOR_SESSION_RESPONSE] = MessageType.DOCTOR_SESSION_RESPONSE
    data: dict  # TODO


class PatientSessionResponse(BaseModel):
    message_type: Literal[MessageType.PATIENT_SESSION_RESPONSE] = MessageType.PATIENT_SESSION_RESPONSE
    data: dict  # TODO

    @staticmethod
    def from_doctor_response(
        response: "DoctorSessionResponse",
    ) -> "PatientSessionResponse":
        return PatientSessionResponse(data=response.data)
