# First-time setup

About 15 minutes, once. Walk the user through one step at a time, explain each in one plain sentence, and check it worked before the next.

## 1. A Blotato account with API access

Blotato is the app that sends the posts to each social app.

- Sign up at https://blotato.com/?ref=robonuggets (RoboNuggets members get 30% off all plans with this link).
- The user needs a paid plan. Blotato's free trial includes every feature except the API, and the API is what this skill uses. Plans and prices change, so check https://www.blotato.com/pricing and make sure the plan the user picks lists API access.
- Done when the user is signed in on a paid plan.

## 2. The API key, in a private file

The API key is like a password: anyone who has it can post as the user.

1. Create the key file named in YOUR SETTINGS (default `~/.secrets/blotato.env`, inside the user's home folder) with this one line and nothing else:

   ```text
   BLOTATO_API_KEY='paste-your-key-here'
   ```

   Keep it outside any folder that syncs, gets shared or goes to GitHub. If the user keeps it in a project folder, add the file name to that folder's `.gitignore`.
2. The user opens Blotato, goes to **Settings**, then **API**, clicks **Copy API Key**, opens the key file themselves and pastes the key over `paste-your-key-here`, keeping the single quotes. Never ask them to paste the key into chat.
3. Copy the whole key. Some keys end in one or more `=`. That is part of the key, and a missing `=` is the most common reason the key is refused.
4. Check it: load the file and call `GET https://backend.blotato.com/v2/users/me` with the header `blotato-api-key`. A 200 answer means it works. Never print the key or the file.

Done when `GET /users/me` answers 200.

## 3. Connect each social account once

1. In Blotato, open **Accounts** (in the left menu), click **Connect account** and pick the app.
2. Sign in on the app's own page and approve the permissions. This happens once per account.
3. Back on Accounts, each account shows an **Account ID** with a copy button. The user copies it and gives it to you, or you list them with `GET /users/me/accounts` and the user tells you which ones are theirs.

Worth knowing before connecting:

- **Instagram** needs a professional account (Business or Creator), and you sign in with Instagram, not Facebook.
- **TikTok** works best on an account that has been used normally for a few weeks first. On Blotato's Starter plan, TikTok allows 3 different posting accounts in any 24 hours.
- **YouTube**: pick the right channel when you sign in. If the user only manages the channel, the channel owner may need to make them an owner.

Done when every channel the user wants has an account ID.

## 4. Save the user's choices

Write these into YOUR SETTINGS at the top of `SKILL.md`, with the user's OK:

- each account ID next to its app (these are the only accounts the skill will ever post to)
- the user's time zone
- posting times and posts per day, if they want something other than 9 am, 1 pm and 5 pm, 3 a day
- the default channels for shorts

Done when YOUR SETTINGS has no empty value the user needs for their first post. The TikTok and YouTube choices can wait: the skill asks for them on the first post to each.
