import Std

/-!
An exact occupancy model for carving a free multilayer support node.
`footprint` is the union of accepted promoted pieces; `support` is the original
support rectangle; `layers` is its original availableZ membership predicate.

This is a specification, not an extraction of TypeScript rectangle subtraction.
The bridge obligation is that subtractRects realizes `support ∧ ¬ footprint`
and that each promoted support piece retains the support node's availableZ.
-/
namespace SupportCarving

variable {Point Layer : Type}

def residual (support footprint : Point → Prop) (layers : Layer → Prop)
    (p : Point) (z : Layer) : Prop :=
  support p ∧ ¬ footprint p ∧ layers z

def promoted (support footprint : Point → Prop) (layers : Layer → Prop)
    (outer : Layer) (p : Point) (z : Layer) : Prop :=
  support p ∧ footprint p ∧ (z = outer ∨ layers z)

-- Carving, rather than rejecting all overlap with free multilayer support,
-- eliminates the duplicate footprint on every layer.
theorem residual_disjoint_promoted
    (support footprint : Point → Prop) (layers : Layer → Prop)
    (outer : Layer) (p : Point) (z : Layer) :
    ¬ (residual support footprint layers p z ∧
       promoted support footprint layers outer p z) := by
  intro h
  exact h.1.2.1 h.2.2.1

-- Every original support-layer point survives, including inner-layer access.
theorem support_access_preserved
    (support footprint : Point → Prop) (layers : Layer → Prop)
    (outer : Layer) (p : Point) (z : Layer)
    (inside : support p) (accessible : layers z) :
    residual support footprint layers p z ∨
      promoted support footprint layers outer p z := by
  classical
  by_cases covered : footprint p
  · exact Or.inr ⟨inside, covered, Or.inr accessible⟩
  · exact Or.inl ⟨inside, covered, accessible⟩

-- Except for the intended new outer layer, the combined result has exactly
-- the same occupancy on every original layer: no inner access is added/lost.
theorem nonouter_occupancy_exact
    (support footprint : Point → Prop) (layers : Layer → Prop)
    (outer : Layer) (p : Point) (z : Layer) (different : z ≠ outer) :
    (residual support footprint layers p z ∨
      promoted support footprint layers outer p z) ↔
    (support p ∧ layers z) := by
  constructor
  · intro h
    rcases h with remaining | merged
    · exact ⟨remaining.1, remaining.2.2⟩
    · exact ⟨merged.1, merged.2.2.resolve_left different⟩
  · intro h
    exact support_access_preserved support footprint layers outer p z h.1 h.2

-- The concrete four-layer case: a [2, 3] free support node remains accessible
-- on layer 2 when a top-layer promotion covers it, while top access is added.
def supportSquare (p : Int × Int) : Prop :=
  0 < p.1 ∧ p.1 < 8 ∧ 0 < p.2 ∧ p.2 < 8

def promotionSquare (p : Int × Int) : Prop :=
  0 < p.1 ∧ p.1 < 4 ∧ 0 < p.2 ∧ p.2 < 4

def supportLayers (z : Nat) : Prop := z = 2 ∨ z = 3

example : promoted supportSquare promotionSquare supportLayers 0 (2, 2) 2 := by
  simp [promoted, residual, supportSquare, promotionSquare, supportLayers]
example : promoted supportSquare promotionSquare supportLayers 0 (2, 2) 0 := by
  simp [promoted, residual, supportSquare, promotionSquare, supportLayers]
example : residual supportSquare promotionSquare supportLayers (6, 6) 2 := by
  simp [promoted, residual, supportSquare, promotionSquare, supportLayers]
example : ¬ residual supportSquare promotionSquare supportLayers (2, 2) 2 := by
  simp [promoted, residual, supportSquare, promotionSquare, supportLayers]

end SupportCarving
