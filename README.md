# Entrenament auditiu · Rockin

Activitat per relacionar fragments de cançons amb descripcions.

- **Alumnat:** `https://USUARI.github.io/NOM-DEL-REPO/`
- **Professorat:** `https://USUARI.github.io/NOM-DEL-REPO/?professorat`

## Fitxers

| Fitxer | Què és |
|---|---|
| `index.html` | La pàgina |
| `app.js`, `app.css` | El funcionament i l'estil (no cal tocar-los) |
| `activitats.json` | **Tot el contingut**: activitats, cançons, descripcions, vídeos extra |

## Com editar el contingut

1. Obre la pàgina amb `?professorat` al final de l'adreça.
2. Fes els canvis i prem **Descarrega activitats.json**.
3. S'obre GitHub a la pàgina «Upload files»: arrossega-hi el fitxer descarregat i prem **Commit changes**.
4. En un o dos minuts la pàgina ja mostra la versió nova.

També es pot editar `activitats.json` directament a GitHub (icona del llapis).

Cada cançó té aquests camps:

```json
{
  "id": "c1",
  "video": "https://www.youtube.com/watch?v=...",
  "start": "0:00",
  "end": "",
  "desc": "Descripció que llegeix l'alumnat",
  "title": "Títol — Artista (es mostra en resoldre)",
  "extra": "Text extra opcional",
  "extraVideos": ["https://www.youtube.com/watch?v=..."]
}
```
