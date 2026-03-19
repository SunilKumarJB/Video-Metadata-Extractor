.PHONY: setup run-backend run-frontend run-all start-all clean

# Include .env if it exists to load environmental variables for local manual runs
-include .env
export

setup:
	@echo "Setting up Backend (Python)..."
	cd backend && python3 -m venv venv && . venv/bin/activate && pip install -r requirements.txt && python3 setup_bq.py
	@echo "Setting up Frontend (Next.js)..."
	cd frontend && npm install && npx next telemetry disable

run-backend:
	@echo "Starting Backend API on port 8000..."
	cd backend && . venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload

run-frontend:
	@echo "Starting Frontend App on port 3000..."
	cd frontend && npm run dev

run-all:
	@echo "Starting both backend and frontend concurrently..."
	$(MAKE) run-backend & $(MAKE) run-frontend

start-all: setup run-all

clean:
	@echo "Cleaning up local builds and environments..."
	rm -rf backend/venv
	rm -rf frontend/node_modules
	rm -rf frontend/.next
	rm -f backend/local_metadata.db*
	rm -f local_metadata.db*
