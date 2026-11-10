# JastipNisa — Design Direction

## Product and audience

A friendly, trustworthy, mobile-first Indonesian personal shopping service for customers discovering Flicka bag models and coordinating purchases with an admin over WhatsApp.

## Visual concept

**Soft editorial boutique commerce**: warm off-white surfaces, espresso typography, muted rose accents and natural product imagery. The interface should feel personal and curated, not like an anonymous marketplace or generic SaaS template.

## Design tokens

- Background: warm ivory `#FAF7F2`
- Surface: white `#FFFFFF`
- Text: espresso `#2F2926`
- Muted: taupe `#7F746D`
- Accent: muted rose `#B76E79`
- Accent-soft: blush `#F4E7E7`
- Border: `#E9E1D9`
- Success: deep sage `#55745D`
- Warning: warm ochre `#9B6C25`
- Danger: muted brick `#A84747`

Use CSS custom properties as the single source of truth. Prefer generous whitespace, thin borders, subtle shadows, serif display typography with a readable sans-serif body, and restrained motion.

## Public information architecture

- `/`: hero, service value, featured catalog references, how it works, fee explanation, policy note, FAQ and WhatsApp CTA.
- `/katalog`: responsive product grid with official source links.
- `/cara-kerja`: six-step order flow including Shopee branch.
- `/kebijakan`: no-store-return disclosure, catalog/stock disclaimer, delivery estimate and open-policy caveats.
- Public header/footer must not expose an admin link.

## Admin information architecture

- `/admin/login`: email/password sign-in.
- `/admin`: protected workspace with overview, catalog and requests/orders navigation.
- Admin screens use a compact operational layout; prioritize clear table hierarchy, status labels, search/filter and mobile-friendly stacked data.

## Interaction rules

- All WhatsApp actions use an explicit configured phone number; when missing, show a setup message instead of a dead link.
- Product cards link to the corresponding official Flicka product page. Label listed price as a reference, not the JastipNisa final quote.
- Display an availability badge such as “Perlu konfirmasi admin”; never say “Ready” based solely on the official catalog.
- The fee calculator updates from the shared fee formula and displays the product count.
- Admin forms have validation, loading, success and error states. Preserve entered data after recoverable failures.
- Provide keyboard focus, semantic headings/landmarks, meaningful image alt text, sufficient contrast and `prefers-reduced-motion` support.
