# Quiz Clone

Clone básico do Kahoot para eventos.

## Rodar

```bash
npm install
npm start
```

Acesse:
- Host: http://localhost:3000/host.html
- Player: http://localhost:3000/player.html

## Editar Perguntas

Abra `server.js` e edite o array `QUIZ`:

```javascript
const QUIZ = [
  {
    question: "Sua pergunta aqui?",
    options: ["Opção A", "Opção B", "Opção C", "Opção D"],
    correct: 0  // índice da resposta correta (0-3)
  },
  // ...
];
```

## Configurações

- `TIME_LIMIT`: segundos por pergunta (padrão: 20)
- `PORT`: porta do servidor (padrão: 3000)



