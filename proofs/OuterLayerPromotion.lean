import Std

/-!
The outer-layer promotion loop, parameterized by the implementation's overlap
predicate. Candidates here have already passed size, support, and transit checks.
All accepted candidates occupy both outer layers. `immutable` contains only
unchanged nodes occupying at least one outer layer.

This proves a selection invariant, not correctness of JavaScript arithmetic,
rectangle subtraction, copper transit, or the complete routing pipeline.
-/
namespace OuterLayerPromotion

variable {α : Type} (conflict : α → α → Bool)

def clear (candidate : α) (existing : List α) : Bool :=
  existing.all (fun prior => !conflict prior candidate)

def Safe : List α → Prop
  | [] => True
  | candidate :: prior => clear conflict candidate prior = true ∧ Safe prior

def Protected (accepted immutable : List α) : Prop :=
  ∀ candidate ∈ accepted, clear conflict candidate immutable = true

def select (immutable : List α) : List α → List α → List α
  | [], accepted => accepted
  | candidate :: rest, accepted =>
    if clear conflict candidate accepted && clear conflict candidate immutable then
      select immutable rest (candidate :: accepted)
    else
      select immutable rest accepted

theorem select_preserves (immutable candidates accepted : List α)
    (safe : Safe conflict accepted)
    (protectedH : Protected conflict accepted immutable) :
    Safe conflict (select conflict immutable candidates accepted) ∧
    Protected conflict (select conflict immutable candidates accepted) immutable := by
  induction candidates generalizing accepted with
  | nil => exact ⟨safe, protectedH⟩
  | cons candidate rest ih =>
    simp only [select]
    split
    next h =>
      have guards : clear conflict candidate accepted = true ∧
          clear conflict candidate immutable = true := by simpa using h
      apply ih
      · exact ⟨guards.1, safe⟩
      · intro r hr
        rcases List.mem_cons.mp hr with equal | previous
        · subst r
          exact guards.2
        · exact protectedH r previous
    next => exact ih accepted safe protectedH

theorem select_safe (immutable candidates : List α) :
    Safe conflict (select conflict immutable candidates []) ∧
    Protected conflict (select conflict immutable candidates []) immutable := by
  apply select_preserves
  · trivial
  · intro r hr
    cases hr

-- A clear guard really excludes each member's conflict predicate.
theorem clear_excludes (candidate prior : α) (existing : List α)
    (h : clear conflict candidate existing = true) (member : prior ∈ existing) :
    conflict prior candidate = false := by
  have each := List.all_eq_true.mp h prior member
  simpa using each

-- Every output is an original candidate or an already accepted rectangle.
theorem select_origin (immutable candidates accepted : List α) (r : α)
    (h : r ∈ select conflict immutable candidates accepted) :
    r ∈ candidates ∨ r ∈ accepted := by
  induction candidates generalizing accepted with
  | nil => exact Or.inr h
  | cons candidate rest ih =>
    simp only [select] at h
    split at h
    next =>
      rcases ih _ h with fromRest | fromAccepted
      · exact Or.inl (List.mem_cons_of_mem _ fromRest)
      · rcases List.mem_cons.mp fromAccepted with same | previous
        · exact Or.inl (List.mem_cons.mpr (Or.inl same))
        · exact Or.inr previous
    next =>
      rcases ih _ h with fromRest | previous
      · exact Or.inl (List.mem_cons_of_mem _ fromRest)
      · exact Or.inr previous

-- Exact integer geometry for concrete counterexamples (no floating-point model).
structure Rect where
  left : Int
  right : Int
  bottom : Int
  top : Int
  deriving DecidableEq, Repr

def overlaps (a b : Rect) : Bool :=
  !(a.right ≤ b.left || b.right ≤ a.left ||
    a.top ≤ b.bottom || b.top ≤ a.bottom)

def Interior (r : Rect) (x y : Int) : Prop :=
  r.left < x ∧ x < r.right ∧ r.bottom < y ∧ y < r.top

theorem nonoverlap_excludes_common_interior (a b : Rect) (x y : Int)
    (h : overlaps a b = false) : ¬(Interior a x y ∧ Interior b x y) := by
  simp [overlaps] at h
  simp only [Interior]
  omega

def square : Rect := ⟨0, 4, 0, 4⟩
def adjacent : Rect := ⟨4, 8, 0, 4⟩

-- Old loop: both independently eligible opposite-layer squares are promoted.
example : ¬ Safe overlaps [square, square] := by
  simp [Safe, clear, overlaps, square]
-- Fixed loop accepts just one of the duplicate footprints.
example : select overlaps [] [square, square] [] = [square] := by decide
-- A candidate cannot be promoted over an unchanged outer-layer footprint.
example : select overlaps [square] [square] [] = [] := by decide
-- Edge contact is allowed; the guard does not reject every candidate.
example : select overlaps [] [square, adjacent] [] = [adjacent, square] := by decide

end OuterLayerPromotion
