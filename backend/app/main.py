from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import close_db_pool, create_db_pool, get_db
from app.routers import anomalies, grid, hierarchy, impact, kpi, timeseries


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.pool = await create_db_pool(settings)
    try:
        yield
    finally:
        await close_db_pool(app.state.pool)


app = FastAPI(title='Supply Chain Digital Twin API', lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
    ],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*']
)

app.include_router(kpi.router, prefix='/api')
app.include_router(timeseries.router, prefix='/api')
app.include_router(anomalies.router, prefix='/api')
app.include_router(hierarchy.router, prefix='/api')
app.include_router(grid.router, prefix='/api')
app.include_router(impact.router, prefix='/api')


@app.get('/api/health')
async def health_check(conn=Depends(get_db)) -> dict[str, str]:
    """Report API liveness and database connectivity."""
    try:
        await conn.fetchval('SELECT 1')
        return {'status': 'ok', 'db': 'connected'}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Health check failed: {exc}') from exc
