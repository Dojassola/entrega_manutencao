const express = require("express");
const fs = require("fs").promises; // MUDANÇA: Usando a versão assíncrona (Promises) do 'fs'
const path = require("path");
const { v4: uuidv4 } = require("uuid"); // NOVO: Biblioteca para gerar IDs únicos e seguros

const app = express();
app.use(express.json({ limit: "50mb" }));

// CORREÇÃO (Segurança): Removido o log do body para não expor dados sensíveis.
// O log agora é limpo
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] Nova requisição: ${req.method} ${req.url}`);
  next();
});

const DB_FILE = path.join(__dirname, "tickets.json");

// CORREÇÃO (Vazamento de Memória): O array 'cache' e o 'setInterval' foram removidos.
// let cache = [];
// setInterval(...);

// CORREÇÃO (Desempenho): Funções agora são 'async' e usam 'await' para não bloquear a thread.
async function readDb() {
  try {
    const txt = await fs.readFile(DB_FILE, "utf8");
    return JSON.parse(txt);
  } catch (error) {
    // Se o arquivo não existir (ENOENT), trata como um banco de dados vazio.
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}


async function writeDb(data) {
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

// ROTA GET /tickets
app.get("/tickets", async (req, res) => { // MUDANÇA: Rota agora é 'async'
  try {
    let list = await readDb();

    // CORREÇÃO (Segurança): 'eval()' foi removido.
    // Implementado um filtro seguro (ex: /tickets?status=open)
    if (req.query.status) {
      list = list.filter((t) => t.status === req.query.status);
    }
    
    // CORREÇÃO (Desempenho): O laço 'for' que bloqueava a CPU foi removido.
    
    res.json(list);
  } catch (error) {
    console.error("Erro ao ler os tickets:", error);
    res.status(500).send("Erro interno no servidor.");
  }
});

// ROTA POST /tickets
app.post("/tickets", async (req, res) => { // MUDANÇA: Rota agora é 'async'
  try {
    // CORREÇÃO (Confiabilidade): Adicionada validação de entrada.
    const { title, customer } = req.body;
    if (!title || !customer) {
      return res.status(400).json({ error: "Os campos 'title' e 'customer' são obrigatórios." });
    }

    const db = await readDb();

    // CORREÇÃO (Confiabilidade): ID incremental substituído por UUID.
    const newTicket = {
      id: uuidv4(),
      // CORREÇÃO (Confiabilidade): Schema padronizado para aceitar apenas 'title'.
      title,
      customer,
      status: req.body.status || "open",
      createdAt: new Date().toISOString(),
    };
    
    // CORREÇÃO (Erro): String SQL inútil e log com variável 'unsafe' removidos.
    db.push(newTicket);
    await writeDb(db);

    res.status(201).json({ ok: true, id: newTicket.id });
  } catch (error) {
    console.error("Erro ao criar o ticket:", error);
    res.status(500).send("Erro interno no servidor.");
  }
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