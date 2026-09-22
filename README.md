# Entrenament auditiu · Rockin

Activitat per relacionar fragments de cançons amb descripcions.

- **Alumnat:** `https://rockin-cat.github.io/entrenament-auditiu/`
- **Professorat:** `https://rockin-cat.github.io/entrenament-auditiu/?professorat`

## Fitxers

| Fitxer | Què és |
|---|---|
| `index.html` | La pàgina |
| `app.js`, `app.css` | El funcionament i l'estil (no cal tocar-los) |
| `activitats.json` | **Tot el contingut**: activitats, cançons, descripcions, vídeos extra |

## Parts de l'activitat

1. **Escolta i relaciona:** fragments de cançons ↔ descripcions.
2. **Vocabulari musical:** s'obre quan l'alumnat resol la part 1. Conceptes ↔ definicions. Si una activitat no té vocabulari, només hi ha la part 1.

## Per al professorat

Obre la pàgina amb `?professorat` i entra a **Professorat**:

- **🔗 Enllaç per a l'alumnat:** crea un enllaç que porta l'activitat a dins. No cal desar res enlloc: l'alumnat l'obre i només veu aquella activitat.
- **📤 Comparteix a la biblioteca:** publica l'activitat a la biblioteca de propostes perquè la vegi la resta del professorat.
- **📚 Biblioteca de propostes:** activitats d'altres docents. Les pots afegir a les teves per adaptar-les o treure'n directament l'enllaç per a l'alumnat.
- Els canvis es guarden automàticament al navegador de cada docent.

La biblioteca fa servir un script de Google (`biblioteca-apps-script.gs`) que desa les propostes en una carpeta de Google Drive, protegida amb un codi del professorat. L'adreça de l'script va a `URL_BIBLIOTECA`, al principi d'`app.js`.

## Com editar les activitats oficials

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

Cada concepte de vocabulari (dins de `"vocab"`):

```json
{ "id": "v1", "term": "Obstinat", "def": "Patró curt que es repeteix moltes vegades..." }
```
