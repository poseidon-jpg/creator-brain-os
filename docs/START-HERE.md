# Start here

1. Open this folder in the Claude desktop app: **Code tab → open folder**.
2. Say **"set me up"**. Claude asks a few questions, saves your answers, checks your tools (`scripts/doctor.sh`) and walks you through your iPhone settings.
3. Read `studio/SHOOTING-GUIDE.md` once.
4. **Before your first edit, run /corpus once** (about 30 min of saving winning videos). It's what makes the editor match your niche instead of guessing.
5. Film a product, then say **/edit**.

## The commands you'll use
| Say | What happens |
|---|---|
| **/edit** | Clips → post-ready videos |
| **/product** | Add or score a product to promote |
| **/corpus** | Study 50-100 winning videos in your category so the editor copies what really works |
| **/learn** | Feed your sales numbers back in so it learns what sells |
| **/hooks** | Hook ideas for a product |
| **/latest** | What's trending in your niche this week |
| **/lab** | Save an idea |
| **/note** | Park feedback for a skill without changing anything yet |
| **/devil** | Red-team anything before you commit to it |
| "open the command center" | Your dashboard at localhost:5210 |

## How it stays good
- **A separate judge checks everything** before you see it (`video-judge`, `critic`). Nothing grades its own work.
- **Drift guard:** every helper agent gets an anti-shortcut brief and has to score itself before finishing.
- **Your taste wins:** tell Claude what you love or hate about an edit and it goes into `studio/TASTE.md`, which the judge and editor read every time.
