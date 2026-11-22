---
name: product
description: Adds and scores TikTok Shop products to film. Turns a pasted product link, selling points or a Kalodata/FastMoss CSV export into a product brief, scores candidates, tracks samples and deadlines, and lists claims to avoid. Use when the user says "/product", "add a product", "should I promote this", "which product next", "score these products", pastes a TikTok Shop link, or drops a CSV in shop/.
---

# /product: what to film next

**Never scrape TikTok or log into tools for the user.** TikTok's terms prohibit automated scripts (VERIFIED, research/lane-d-workflow-ops.md). The user pastes info or exports a CSV themselves.

## Add one
1. Ask for: the link, price, commission %, 3-5 selling points (or paste the listing text), and the sample status.
2. Write `shop/products/<slug>/brief.md` from `shop/products/_TEMPLATE.md`. Fill in **Claims to avoid** from the category (beauty: "cures acne", "no side effects"; supplements: any health claim or GLP-1 mention; anything: "guaranteed", "lowest price"). See RUBRIC.md `banned-claim`.
3. Name **the one proof moment** to film first (the shot that proves it works).
4. Suggest 3 hook shapes from `creative/banks/hooks.md` that fit this product, and say why.
5. Add a row to `shop/product-tracker.md` (create it if missing): product, price, commission, est. earning per sale, sample requested/arrived/post-by dates, status.

## Score a list (CSV or several pastes)
Score = estimated earning per sale × demand signal × filmability (1-3: can it show a visible result in 3 seconds?). Show the formula and every input. Label every number by where it came from (their CSV, the listing, or your guess). Rank them, recommend the top 3, and say what would change your mind. Run the `critic` agent on the top pick if they're about to request samples.

## Deadlines
When asked "what's due", read the tracker and list samples whose post-by date is within 7 days.
