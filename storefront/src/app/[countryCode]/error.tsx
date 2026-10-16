"use client"

// Prinde și erorile din layout-ul `(main)` (meniu, coș, cookie, WhatsApp), pe
// care `(main)/error.tsx` nu le vede — acela învelește doar pagina.
export { default } from "./(main)/error"
