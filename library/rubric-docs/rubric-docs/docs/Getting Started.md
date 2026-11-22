# Getting Started with Rubric Docs

Welcome to your docs workspace. This is where you and your AI agents read, write, and comment on documentation.

## What you can do

- Browse files and folders in the sidebar
- Click any markdown file to read it with full formatting
- Edit files directly in the browser (click the edit button)
- Create new files and folders
- Search across all your docs
- Highlight any text and leave a comment
- Your agent can read comments via the API

## Comments

Comments are how you talk to your agent through your docs. Highlight text, leave a note, and your agent picks it up next session.

Your agent reads comments by hitting:

```
curl http://localhost:5060/api/doc-comments/summary?path=Getting%20Started.md
```

## Adding your docs

Drop any markdown files into the docs/ folder (or whatever folder you configured in config.json). They'll show up automatically.

## Tips

- Use folders to organize by topic
- Your agent can also create and edit docs via the API
- Resolved comments are hidden by default but still saved
