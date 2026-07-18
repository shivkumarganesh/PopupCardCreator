import { useMemo } from 'react';
import * as THREE from 'three';

export interface BaseCardProps {
  /** Card opening angle in degrees: 0 = closed, 180 = flat open. */
  openAngleDeg: number;
  /** Width of one panel (gutter → outer edge) in world units. */
  panelWidth?: number;
  /** Card height (along the gutter) in world units. */
  height?: number;
}

/**
 * The base card: two rigid panels hinged along the gutter (the z-axis).
 *
 * At 180° both panels lie flat in the xz-plane; closing the card rotates each
 * panel symmetrically upward about the gutter, like a book standing on its
 * spine. The dihedral between the panels is exactly `openAngleDeg`.
 */
export function BaseCard({ openAngleDeg, panelWidth = 6.5, height = 9 }: BaseCardProps) {
  const halfDihedral = THREE.MathUtils.degToRad(openAngleDeg) / 2;
  // Each panel's rotation about the gutter, measured from flat (xz-plane).
  const tilt = Math.PI / 2 - halfDihedral;

  const panelGeometry = useMemo(
    () => new THREE.PlaneGeometry(panelWidth, height),
    [panelWidth, height],
  );

  return (
    <group>
      {/* Left panel: hinged at x = 0, extends toward -x */}
      <group rotation={[0, 0, tilt]}>
        <mesh
          geometry={panelGeometry}
          position={[-panelWidth / 2, 0, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <meshStandardMaterial color="#f5f0e6" side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* Right panel: mirror image */}
      <group rotation={[0, 0, -tilt]}>
        <mesh
          geometry={panelGeometry}
          position={[panelWidth / 2, 0, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <meshStandardMaterial color="#efe8d8" side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* Gutter line, for visual reference */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, height]} />
        <meshBasicMaterial color="#b09a6d" />
      </mesh>
    </group>
  );
}
