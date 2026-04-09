# CELEBRAIT — FOUNDATION DOCUMENT

## Purpose

This document defines the current product, system boundaries, and engineering rules for Celebrait.

It exists to:
- protect the working core flow
- prevent reintroduction of legacy behaviour
- ensure consistent decision-making
- align AI-assisted development with product intent

This is the **source of truth for what the system currently is**.

---

## 1. Current Product Definition

Celebrait is:

> A photo-based AI greeting card generation system.

### Core Flow (Happy Path)

1. User uploads one or more photos  
2. User describes a scene  
3. System generates front artwork  
4. System generates matching inside card + message  
5. User completes OTP verification  
6. System sends email with preview link  
7. User views card preview  

This is:
- the ONLY supported user journey  
- stable and working end-to-end  
- the core product  

---

## 2. Product Boundaries (Strict)

The following are NOT part of the current product:

- Text-only generation  
- Transform-only generation  
- Multiple generation modes  
- Alternate onboarding flows  
- Experimental prompt paths  

Even if present in code, these are:

> NOT ACTIVE  
> NOT SUPPORTED  
> NOT USER-FACING  

They must not be reintroduced without explicit instruction.

---

## 3. System Reality

The previous Replit build:
- proved the concept end-to-end  
- enabled rapid iteration  
- contains legacy flows and fallback behaviour  

### Key Insight:

> The system worked, but was not controlled.

This rebuild is not about fixing failure.

It is about:

> Converting a working prototype into a controlled, extensible system.

---

## 4. Engineering Philosophy

### Priority Order

1. Protect the working flow  
2. Remove hidden behaviour  
3. Reduce ambiguity  
4. Make the system predictable  
5. Enable future configurability  

---

### Principles

- Clarity over speed  
- Control over experimentation  
- Explicit over implicit  
- Structure over hacks  
- Reversible changes over destructive ones  

---

## 5. Generation Rules

Only one generation type is valid:

```text
scene (photo-based)

Enforced by:
•	frontend requires uploaded photos
•	backend rejects non-scene types
•	fallback generation removed
 
6. Legacy Strategy

Legacy code includes:
•	text-only generation
•	transform generation
•	actuallyGenerateCard

Rules:
•	Do not delete immediately
•	Do not use in current flow
•	Mark as deprecated when appropriate
•	Isolate before removal
 
7. What is Dangerous

The following must not be done without explicit instruction:
•	Adding new flows
•	Reintroducing text-only or transform
•	Modifying the happy path
•	Changing prompt behaviour
•	Adding fallback logic
•	Mixing legacy + new systems
 
8. Current Phase

Phase: Foundation & Alignment

Completed:
•	backend guard (scene only)
•	frontend photo requirement
•	fallback removal
•	provider + storage abstraction

In progress:
•	legacy isolation
•	system clarity
 
9. Next Phase

Configuration Layer

Goal:

Remove hardcoding from prompts and models.

This enables:
•	prompt lab
•	multi-model support
•	controlled testing
 
10. Success Criteria

The system is successful when:
•	flow works reliably every time
•	no hidden behaviour exists
•	system is predictable
•	changes are safe and reversible
•	legacy code does not interfere
 
11. Mental Model

Celebrait is transitioning from:

“An AI experiment that works”

to:

“A structured, extensible product system”
 
12. How to Work With This Codebase

Before making changes:
•	understand the current flow
•	do not expand scope
•	prefer minimal changes
•	ask before acting when unsure
 
13. Relationship to Founder Doc
•	FOUNDATION = current reality
•	FOUNDER = future direction

Rule:

Founder informs direction
Foundation controls implementation
