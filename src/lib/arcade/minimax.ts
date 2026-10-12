const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]

export function checkWinner(b: string[]): 'X' | 'O' | 'D' | null {
  for (const [a, c, d] of LINES) {
    if (b[a] !== '-' && b[a] === b[c] && b[a] === b[d]) {
      return b[a] as 'X' | 'O'
    }
  }
  return b.includes('-') ? null : 'D'
}

function minimax(
  b: string[],
  me: 'X' | 'O',
  turn: 'X' | 'O',
  depth: number,
  alpha = -99,
  beta = 99
): number {
  const w = checkWinner(b)
  if (w === 'D') return 0
  if (w) return w === me ? 10 - depth : depth - 10

  let best = turn === me ? -99 : 99
  const opponent = turn === 'X' ? 'O' : 'X'

  for (let i = 0; i < 9; i++) {
    if (b[i] === '-') {
      b[i] = turn
      const score = minimax(b, me, opponent, depth + 1, alpha, beta)
      b[i] = '-'

      if (turn === me) {
        best = Math.max(best, score)
        alpha = Math.max(alpha, score)
      } else {
        best = Math.min(best, score)
        beta = Math.min(beta, score)
      }
      if (beta <= alpha) break
    }
  }

  return best
}

export function getBestMove(
  board: string[],
  aiSymbol: 'X' | 'O',
  difficulty: 'easy' | 'medium' | 'hard' = 'hard'
): number {
  const availableMoves: number[] = []
  for (let i = 0; i < 9; i++) {
    if (board[i] === '-') availableMoves.push(i)
  }

  if (availableMoves.length === 0) return -1

  // Nivel Fácil: Movimiento 100% aleatorio
  if (difficulty === 'easy') {
    return availableMoves[Math.floor(Math.random() * availableMoves.length)]
  }

  // Nivel Medio: 50% de probabilidad de jugar aleatorio
  if (difficulty === 'medium' && Math.random() < 0.5) {
    return availableMoves[Math.floor(Math.random() * availableMoves.length)]
  }

  // Nivel Difícil (o 50% de Medio): Minimax óptimo
  let bestScore = -999
  let bestMove = availableMoves[0]
  const opponent = aiSymbol === 'X' ? 'O' : 'X'

  for (const move of availableMoves) {
    board[move] = aiSymbol
    const score = minimax(board, aiSymbol, opponent, 0)
    board[move] = '-'

    if (score > bestScore) {
      bestScore = score
      bestMove = move
    }
  }

  return bestMove
}
