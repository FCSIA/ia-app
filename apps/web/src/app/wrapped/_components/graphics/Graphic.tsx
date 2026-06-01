'use client';

import { OrbsGraphic } from './Orbs';
import { GridGraphic } from './Grid';
import { RingsGraphic } from './Rings';
import { BlobsGraphic } from './Blobs';
import { ConfettiGraphic } from './Confetti';
import { StarsGraphic } from './Stars';
import { WavesGraphic } from './Waves';
import type { GraphicKind } from '../../_lib/types';

export function Graphic({ kind }: { kind: GraphicKind }) {
  if (kind === 'orbs') return <OrbsGraphic />;
  if (kind === 'grid') return <GridGraphic />;
  if (kind === 'rings') return <RingsGraphic />;
  if (kind === 'blobs') return <BlobsGraphic />;
  if (kind === 'confetti') return <ConfettiGraphic />;
  if (kind === 'stars') return <StarsGraphic />;
  return <WavesGraphic />;
}
