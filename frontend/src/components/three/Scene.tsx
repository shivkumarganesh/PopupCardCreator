import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useCardStore } from '../../state/store';
import { BaseCard } from './BaseCard';
import { ParallelFold } from './ParallelFold';

/** World units per millimetre: a 130 mm panel becomes 6.5 world units. */
const WORLD_PER_MM = 1 / 20;

export function Scene() {
  const openAngleDeg = useCardStore((s) => s.openAngleDeg);
  const card = useCardStore((s) => s.card);
  const mechanisms = useCardStore((s) => s.mechanisms);

  return (
    <Canvas camera={{ position: [12, 11, 18], fov: 40 }} shadows>
      <color attach="background" args={['#1c1e24']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[6, 10, 6]} intensity={1.2} />
      <directionalLight position={[-6, 4, -4]} intensity={0.3} />
      <BaseCard
        openAngleDeg={openAngleDeg}
        card={card}
        mechanisms={mechanisms}
        worldPerMm={WORLD_PER_MM}
      />
      {mechanisms.map((m) =>
        m.type === 'parallelFold' ? (
          <ParallelFold
            key={m.id}
            mechanism={m}
            card={card}
            openAngleDeg={openAngleDeg}
            worldPerMm={WORLD_PER_MM}
          />
        ) : null,
      )}
      <gridHelper args={[30, 30, '#3a3f4c', '#2a2e38']} position={[0, -0.05, 0]} />
      <OrbitControls makeDefault target={[0, 2, 0]} minDistance={4} maxDistance={40} />
    </Canvas>
  );
}
