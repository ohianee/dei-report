# DEI Report

Aplicación que genera informes automáticos de calidad **DEI** (diversidad, equidad e inclusión) analizando el código y la actividad de repositorios de GitHub: lenguaje inclusivo, tono/toxicidad, diversidad léxica entre autores/repos y un chatbot que responde preguntas sobre el informe generado.

El proyecto tiene tres partes que se ejecutan por separado:

| Servicio | Carpeta | Puerto por defecto | Descripción |
|---|---|---|---|
| API principal | backend/ (main.py) | 8000 | Registro/login, lanzamiento de análisis, GitHub OAuth |
| Microservicio de chat IA | backend/ (main_chat.py) | 8001 | Chatbot LLM (Phi-3) sobre el informe generado |
| Frontend | frontend/ | 4000 | Angular (SSR) |

---

## 1. Requisitos previos

- **Python 3.12**
- **Node.js** y **npm** (el proyecto usa npm@11.8.0, indicado en frontend/package.json)
- Un compilador C/C++ disponible en el sistema (necesario para instalar llama-cpp-python, que compila el binding de llama.cpp)
- Espacio en disco suficiente para los modelos (varios GB en total: BERT, spaCy y el modelo Phi-3 en GGUF)

---

## 2. Backend (backend/)

### 2.1. Entorno virtual y dependencias

```bash
cd backend
python3.12 -m venv venv
source venv/bin/activate

pip install -r requirements.txt
```

### 2.2. Modelo de spaCy

El análisis NLP usa el modelo en_core_web_sm de spaCy, que no viene incluido en requirements.txt y hay que descargarlo aparte:

```bash
python -m spacy download en_core_web_sm
```

### 2.3. Modelos de BERT (descarga automática)

Los modelos distilbert-base-uncased-finetuned-sst-2-english (sentimiento) y unitary/toxic-bert (toxicidad) se descargan **automáticamente** desde Hugging Face la primera vez que arranca el backend (vía transformers). No hace falta ninguna acción manual, solo tener conexión a internet la primera vez.

### 2.4. Modelo LLM del chatbot (Phi-3) — descarga manual

El microservicio de chat (main_chat.py) necesita un modelo **Phi-3-mini en formato GGUF**, que **no se distribuye en el repositorio por su peso** y hay que descargarlo y colocarlo a mano:

1. Descarga una versión cuantizada de **Phi-3-mini-4k-instruct** en formato .gguf (por ejemplo desde el repositorio microsoft/Phi-3-mini-4k-instruct-gguf en Hugging Face; se recomienda una cuantización tipo q4 como buen equilibrio entre tamaño y calidad).
2. Crea la carpeta modelos_ia dentro de backend/ si no existe.
3. Renombra el archivo descargado a **phi-3-mini.gguf** y colócalo en:

   ```
   backend/modelos_ia/phi-3-mini.gguf
   ```

   Ruta completa que espera el código (ver analisis/llm_motor.py):

   ```
   backend/modelos_ia/phi-3-mini.gguf
   ```

4. Verifica que la versión de llama-cpp-python instalada (0.3.34, ver requirements.txt) es compatible con el .gguf descargado.

> Si el archivo no está en esa ruta, el microservicio de chat lanzará FileNotFoundError al intentar cargar el modelo (no impide arrancar main.py, solo afecta al chatbot).

### 2.5. Variables de entorno

Copia el archivo de ejemplo y rellena los valores:

```bash
cp token.env.example token.env
```

Contenido a configurar en token.env:

- **ENTORNO**: dev (habilita /docs y /redoc) o cualquier otro valor en producción.
- **GITHUB_TOKEN**: token de una cuenta de GitHub (idealmente "de servicio", con permisos mínimos de solo lectura) usado como *fallback* para sesiones anónimas.
- **GITHUB_CLIENT_ID** / **GITHUB_CLIENT_SECRET**: credenciales de una OAuth App de GitHub, necesarias para que los usuarios registrados puedan vincular su propia cuenta. Se crean en GitHub → *Settings* → *Developer settings* → *OAuth Apps*. Como *Authorization callback URL* usa http://localhost:8000/auth/github/callback (o el valor equivalente en producción según BACKEND_URL).
- **GITHUB_OAUTH_SCOPE**: por defecto repo read:org read:user, no suele hacer falta tocarlo.
- **FERNET_KEY**: clave usada para cifrar los tokens de GitHub de los usuarios en base de datos. Se genera así:

  ```bash
  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
  ```

- **BACKEND_URL** / **FRONTEND_URL**: URLs base usadas para construir el redirect_uri de OAuth y las redirecciones de vuelta al frontend (por defecto http://localhost:8000 y http://localhost:4000).
- **CHAT_BACKEND_URL**: URL del microservicio de chat (por defecto http://localhost:8001).

⚠️ **Nunca subas token.env (con secretos reales) a git.**

### 2.6. Arrancar el backend

Con el entorno virtual activado, en dos terminales distintas:

```bash
# Terminal 1 — API principal (puerto 8000)
uvicorn main:app --reload --port 8000

# Terminal 2 — microservicio de chat IA (puerto 8001)
uvicorn main_chat:app --reload --port 8001
```

Documentación interactiva (solo con `ENTORNO=dev):
- API principal: http://localhost:8000/docs
- Chat: http://localhost:8001/docs

### 2.7. Tests

```bash
cd backend
pytest
```

---

## 3. Frontend (frontend/)

### 3.1. Instalación

```bash
cd frontend
npm install
```

### 3.2. Arrancar en desarrollo

⚠️ El backend tiene el CORS configurado para aceptar peticiones desde http://localhost:4000 (ver main.py), pero ng serve arranca por defecto en el puerto **4200**. Arráncalo indicando el puerto **4000** para que coincida:

```bash
npm start -- --port 4000
```

La app quedará disponible en http://localhost:4000/.

Las URLs del backend que usa el frontend están fijadas en src/app/compartido/baseurl.ts:
```
baseURL = 'http://localhost:8000/'
chatURL = 'http://localhost:8001/'
```
Si cambias los puertos del backend, actualiza también este archivo (y el CORS en backend/main.py).

### 3.3. Build de producción / SSR

```bash
npm run build
npm run serve:ssr:deiReport
```

Por defecto el servidor SSR escucha en el puerto 4000 (variable PORT, ver src/server.ts).

### 3.4. Tests

```bash
npm test
```

---

## 4. Resumen rápido (orden de arranque)

```bash
# 1) Backend — API principal
cd backend
python3.12 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
cp token.env.example token.env   # y rellenar valores (ver sección 2.5)
# colocar el modelo descargado en backend/modelos_ia/phi-3-mini.gguf (ver sección 2.4)
uvicorn main:app --reload --port 8000

# 2) Backend — microservicio de chat (otra terminal, mismo venv)
cd backend
source venv/bin/activate
uvicorn main_chat:app --reload --port 8001

# 3) Frontend (otra terminal)
cd frontend
npm install
npm start -- --port 4000
```

Con los tres servicios arrancados, abre http://localhost:4000/.