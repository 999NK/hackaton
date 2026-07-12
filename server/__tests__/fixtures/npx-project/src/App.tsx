import React from 'react'

export default function App() {
  return (
    <main>
      <h1>Fixture Skip</h1>
      <nav aria-label="Principal">
        <a href="/settings">Configuracoes</a>
      </nav>
      <form>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" />
        <button type="submit">Entrar</button>
      </form>
    </main>
  )
}
