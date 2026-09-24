import Std

/-!
The outer-layer promotion loop, abstracting candidates that already pass size,
support, and transit checks. Every accepted candidate occupies both outer layers.
`conflict` corresponds to the TypeScript overlap predicate, including its EPS
behavior; its arithmetic implementation is not verified here.
-/
namespace DuplicatePromotion

variable {α : Type} (conflict : α → α → Bool)

def clear (candidate : α) (existing : List α) : Bool :=
  existing.all (fun prior => !conflict prior candidate)

def Safe : List α → Prop
  | [] => True
  | candidate :: prior => clear conflict candidate prior = true ∧ Safe prior

def select : List α → List α → List α
  | [], accepted => accepted
  | candidate :: rest, accepted =>
    if clear conflict candidate accepted then
      select rest (candidate :: accepted)
    else
      select rest accepted

theorem select_preserves (candidates accepted : List α)
    (safe : Safe conflict accepted) :
    Safe conflict (select conflict candidates accepted) := by
  induction candidates generalizing accepted with
  | nil => exact safe
  | cons candidate rest ih =>
    simp only [select]
    split
    next h => exact ih _ ⟨h, safe⟩
    next => exact ih accepted safe

theorem select_safe (candidates : List α) :
    Safe conflict (select conflict candidates []) :=
  select_preserves conflict candidates [] True.intro

theorem clear_excludes (candidate prior : α) (existing : List α)
    (h : clear conflict candidate existing = true) (member : prior ∈ existing) :
    conflict prior candidate = false := by
  have each := List.all_eq_true.mp h prior member
  simpa using each

theorem select_origin (candidates accepted : List α) (r : α)
    (h : r ∈ select conflict candidates accepted) :
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

-- Exact integer geometry only for concrete examples, not JavaScript numbers.
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

-- Old independent promotions violate safety.
example : ¬ Safe overlaps [square, square] := by
  simp [Safe, clear, overlaps, square]
-- The new loop removes duplicate footprints without rejecting adjacent space.
example : select overlaps [square, square] [] = [square] := by decide
example : select overlaps [square, adjacent] [] = [adjacent, square] := by decide

end DuplicatePromotion
