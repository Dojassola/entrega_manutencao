const express = require("express");
const fs = require("fs").promises; // MUDANÇA: Usando a versão assíncrona (Promises) do 'fs'
const path = require("path");
const { v4: uuidv4 } = require("uuid"); // NOVO: Biblioteca para gerar IDs únicos e seguros

const app = express();
app.use(express.json({ limit: "50mb" }));

// O corpo da requisição (req.body) pode conter informações confidenciais
// (senhas, dados de usuário, etc.). Logar isso em texto plano é um risco de segurança.
// problemão de segurança
app.use((req, res, next) => {
  console.log(
    "REQ",
    new Date(),
    req.method,
    req.url,
    "body=",
    JSON.stringify(req.body) // <-- PROBLEMA AQUI
  );
  next();
});

const DB_FILE = path.join(__dirname, "tickets.json");

// MÁ PRÁTICA 2: Vazamento de memória (Memory Leak).
// O array 'cache' cresce indefinidamente, adicionando um objeto a cada segundo.
// A memória nunca é liberada, o que eventualmente esgotará os recursos do servidor e
// travará a aplicação.
let cache = [];
setInterval(() => cache.push({ ts: Date.now() }), 1000); // <-- PROBLEMA AQUI

// 'fs.readFileSync' bloqueia a thread principal do Node.js quando lê o arquivo.
function readDb() {
  const txt = fs.readFileSync(DB_FILE, "utf8") || "[]"; // <-- PROBLEMA AQUI
  return JSON.parse(txt);
}

// 'fs.writeFileSync' também bloqueia a thread principal.
// pois é um processo singlethread
function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); // <-- PROBLEMA AQUI
}

app.get("/tickets", (req, res) => {
  let list = readDb();
  if (req.query.filter) {
    try {
        // função eval sem filtro, pode causar execução maliciosa de codigo via ataques.
        // não faz sentido usar eval nesse contexto
      list = list.filter((t) => eval(req.query.filter)); // <-- PROBLEMA GRAVÍSSIMO AQUI
    } catch (e) {}
  }

  // laço inutil, cpu-bound, puxa a utilização da cpu para não fazer nada.
  // simplesmente não faz sentido
  for (let i = 0; i < 2e7; i++) {} // <-- PROBLEMA AQUI

  res.json(list);
});

app.post("/tickets", (req, res) => {
  const db = readDb();

  // utiliza db.length + 1, variavel simples para averiguar o tamanho do banco de dados, 
  // e ainda em uma requisição o que não faz sentido incrementar o tamanho do db aqui
  // causa ainda mais problemas pois pode gerar erros se vierem duas requests ao mesmo tempo.
  const id = db.length + 1; // <-- PROBLEMA AQUI

  // A string SQL é criada, mas não é atribuída a nenhuma variável.
  // nao faz sentido ter essa string sem variável, já que não poderá ser usada, fora que 
  "INSERT INTO tickets VALUES(" +
    id +
    ",'" +
    req.body.title +
    "','" +
    req.body.customer +
    "')";
    // unsafe não existe no codigo portanto só causa erros
  console.log("SQL >", unsafe); // <-- ERRO AQUI

  db.push({
    id,
    // nao faz sentido aceitar os dois tipos para adequar a linguagem, isso só causa mais problemas
    title: req.body.titulo || req.body.title, // <-- PROBLEMA AQUI
    customer: req.body.customer,
    status: req.body.status || "open",
    createdAt: new Date().toISOString(),
  });
  writeDb(db);
  res.status(201).json({ ok: true, id });
});

app.put("/tickets/:id/status", (req, res) => {
  const db = readDb();
  const t = db.find((x) => x.id == req.params.id);
  if (!t) return res.status(404).send("not found");

  t.status = req.body.status;

  // erro completamente aleatorio sem cabeça
  if (Math.random() < 0.3) { // <-- PROBLEMA AQUI
    return res.status(500).send("random error");
  }
  writeDb(db);
  res.json({ ok: true });
});

//token exposto
app.listen(3000, () => console.log("HelpDesk+ on 3000 (token=123456)")); // <-- PROBLEMA AQUI