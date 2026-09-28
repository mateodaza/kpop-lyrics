# Aegyo fan chat: initial safety assessment and operating decision

Prepared 2026-09-28 for the proposed public chat launch. This records the product's actual controls and the decisions the operator must own. It is not legal certification. Reassess after an incident, a material feature change, or within 30 days of launch.

## Service and audience

- One public, text-only K-pop room embedded in Aegyo Arena. Anyone can read; posting and in-product reporting need a shared account. There are no direct messages, images, uploads, or clickable links in chat.
- Posting requires a 16+ self-declaration. We do not have high-effectiveness age assurance. Because K-pop content can attract minors and reading is public, treat the room as **likely accessible to under-18s** for the initial safety design. Do not claim the checkbox excludes children.
- The desired audience is worldwide, including the UK and EU. There is no geographic restriction in production. The operator must review the actual jurisdictions and service data before deciding that any regulation does not apply.

## Risks and current controls

| Risk | Current control | Remaining risk and required operator action |
| --- | --- | --- |
| Sexual exploitation, grooming, or off-platform contact | No DMs, images, links, or contact details; pre-publication automated screening; one sexual or personal-information report immediately hides a visible message pending review. | Filters can miss coded language. Moderators inspect the queue, remove content, restrict accounts, and escalate suspected child exploitation through the applicable reporting route. Do not redistribute illegal material in ordinary email. |
| Harassment, hate, threats, self-harm encouragement, fan-war pile-ons | Pre-publication screening and pattern rules; account and site-wide rate limits; reports; 24-hour mute or indefinite chat restriction. | One ordinary report leaves the message visible; two independent reports hide it. Staff need frequent queue checks and a route for urgent reports. |
| Underage posting and exposure of personal information | 16+ declaration; personal-detail filter; dedicated underage report reason holds the reported message immediately; moderator can restrict the account and remove its visible or held posts. | A declaration is not age verification. The operator must respond to credible underage reports and parental/privacy requests and assess whether any further data handling is required. |
| Erroneous automated or human decisions | Held content is private, review queue is available, author can see recent moderation status, and the terms give an appeal email. Removal requires a recorded reason. | The mailbox needs a named human owner and a consistent appeal procedure. Human review remains necessary. |
| Safety queue unattended outside events | Operators can disable chat posting by unsetting `AEGYO_CHAT_ENABLED`; a failed classifier pauses posting. | There are no automated human alerts. Assign primary and backup reviewers, several queue checks each day, and active coverage during promoted events. If this cannot be staffed, limit posting hours or keep chat disabled. |

## Initial operator procedure

1. A primary moderator checks `/admin/chat` several times daily and actively during promoted events. A backup covers absence. Both can review messages; the account owner maintains the Railway kill switch.
2. For a report involving personal information, sexual content, or an apparently underage poster, review the held item promptly. Remove unsafe content, restrict the account if needed, and record the reason. Do not disclose reporter identities.
3. For credible threats, exploitation, or immediate danger, preserve only the information needed for an appropriate escalation and follow the applicable reporting process; chat is not an emergency service.
4. Route email notices and appeals sent to `privacy@aegyoarena.com` to the named owner. Record receipt, decision, and response without storing unnecessary personal details. Reconsider a decision with a second reviewer where practical.
5. If reviewer coverage, reporting mailbox, or automated screening fails, switch chat off and keep the data for investigation under the published retention rules.

## Jurisdiction checks still requiring an accountable company owner

- **UK:** Record the children's access assessment treating this room as likely accessible to children unless reliable evidence says otherwise; assess illegal-content and child-safety risks, document proportionate measures and complaints handling. Ofcom says covered user-to-user services must assess child access and illegal harms, and that self-declaration alone is not highly effective age assurance. [Child access](https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/childrens-access-assessment-duties-under-the-online-safety-act), [illegal content duties](https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/illegal-content-duties-under-the-online-safety-act).
- **EU:** Confirm provider classification and size, contact point, illegal-content notice handling, moderation reasons, appeal route, and applicable transparency duties. Small-enterprise exceptions affect some additional duties, not every DSA obligation. If the provider offers the service in the EU without an EU establishment, Article 13 calls for a designated EU legal representative; no establishment or representative has been confirmed for Myosin. [Digital Services Act, Articles 11–17](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32022R2065), [Commission overview](https://digital-strategy.ec.europa.eu/en/policies/digital-services-act).
- **US and other countries:** Continue the child-directed/actual-knowledge and privacy assessment; a 16+ label does not remove the need for an underage response. [FTC COPPA FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions).

The company owner records who accepted these risks and the date. No geographic restriction or legal clearance should be inferred from this document alone.
