from asyncio import Future, Lock
from dataclasses import dataclass
from logging import getLogger

from fastapi import WebSocket, WebSocketDisconnect

from app.errors import CodeNotFound
from app.schemas import DoctorSessionInit, DoctorSessionPatientConnected, DoctorSessionResponse

logger = getLogger("uvicorn.error")


@dataclass
class ActiveConnection:
    websocket: WebSocket
    code: str
    future: Future[DoctorSessionResponse]


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: list[ActiveConnection] = []
        self.lock = Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        active_connection = None
        clean_exit = False
        try:
            data = await websocket.receive_text()
            init_message = DoctorSessionInit.model_validate_json(data)
            active_connection = ActiveConnection(websocket, init_message.code, Future())
            async with self.lock:
                self.active_connections.append(active_connection)

            logger.info(f"Doctor connected with code {init_message.code}")

            async for message in websocket.iter_text():
                active_connection.future.set_result(DoctorSessionResponse.model_validate_json(message))
                break

            logger.info(f"Closing connection for doctor with code {init_message.code}")
            clean_exit = True

        except WebSocketDisconnect:
            clean_exit = True

        except Exception as e:
            logger.error(f"Error in doctor connection: {e} with data {data}")
            raise e

        finally:
            if not clean_exit:
                try:
                    await websocket.close()
                except Exception as e:
                    logger.warning(f"Error during doctor connection close: {e}")

            if active_connection:
                async with self.lock:
                    self.active_connections.remove(active_connection)

    async def get_data_by_code(self, code: str) -> DoctorSessionResponse:
        async with self.lock:
            for connection in self.active_connections:
                if connection.code == code:
                    await connection.websocket.send_json(DoctorSessionPatientConnected().model_dump())
                    return await connection.future

        raise CodeNotFound()
