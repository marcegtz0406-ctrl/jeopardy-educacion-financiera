const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

let preguntasData = {};
try {
  const data = fs.readFileSync(path.join(__dirname, 'preguntas.json'), 'utf8');
  preguntasData = JSON.parse(data);
} catch (err) {
  console.error("Error al cargar preguntas.json:", err);
}

// Endpoint para obtener las preguntas
app.get('/api/preguntas', (req, res) => {
  res.json(preguntasData);
});

// Endpoint para llamar a DeepSeek con retroalimentación cercana e interactiva
app.post('/api/reflexion', async (req, res) => {
  const { pregunta, respuesta, esCorrecta } = req.body;

  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: "Clave de API de DeepSeek no configurada." });
  }

  const prompt = `
Eres un tutor/profesor entusiasta y cercano de Educación Financiera en México.
Analiza la siguiente pregunta de un juego educativo y la respuesta dada.

Pregunta: "${pregunta}"
Respuesta del alumno / respuesta esperada: "${respuesta}"
Estado de la respuesta: ${esCorrecta ? 'El alumno respondió CORRECTAMENTE' : 'El alumno respondió INCORRECTAMENTE o requiere aclaración'}

Instrucciones para la respuesta:
1. Responde en un tono coloquial, motivador y directo en español latinoamericano (máximo 3-4 oraciones).
2. Si fue correcta, empieza felicitándolo de forma entusiasta ("¡Excelente decisión!", "¡Muy bien pensado!") y explica brevemente por qué es acertada basándote en la diferencia entre Branch A (deseos e impulsos irrelevantes que generan inestabilidad) y Branch B (necesidades básicas y estabilidad financiera).
3. Si fue incorrecta, corrígelo amablemente ("¡Cerca! Pero recuerda que...", "¡Buen intento!") y da la explicación clave sobre la prioridad financiera.
4. Redacta el texto ideal para ser leído en voz alta.
`;

  try {
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'Eres un profesor de educación financiera interactivo y motivador en México.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const reflexion = response.data.choices[0].message.content.trim();
    res.json({ reflexion });
  } catch (error) {
    console.error("Error al llamar a la API de DeepSeek:", error.response ? error.response.data : error.message);
    res.status(500).json({ error: "No se pudo generar la reflexión en este momento." });
  }
});

// Lógica de Socket.io para el pulsador (Buzzer)
let estadoJuego = {
  buzzerActivo: false,
  bloqueadoPor: null
};

io.on('connection', (socket) => {
  socket.emit('estado', estadoJuego);

  socket.on('activar_buzzer', () => {
    estadoJuego.buzzerActivo = true;
    estadoJuego.bloqueadoPor = null;
    io.emit('buzzer_activado');
  });

  socket.on('presionar_buzzer', (datosAlumno) => {
    if (estadoJuego.buzzerActivo && !estadoJuego.bloqueadoPor) {
      estadoJuego.buzzerActivo = false;
      estadoJuego.bloqueadoPor = datosAlumno.nombre || 'Alumno';
      io.emit('alguien_presiono', { nombre: estadoJuego.bloqueadoPor });
    }
  });

  socket.on('reiniciar_buzzer', () => {
    estadoJuego.buzzerActivo = false;
    estadoJuego.bloqueadoPor = null;
    io.emit('buzzer_reiniciado');
  });
});

server.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
