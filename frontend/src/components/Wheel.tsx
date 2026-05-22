import { useMemo } from 'react';
import { Wheel as Roulette } from 'react-custom-roulette';

const PALETTE = [
  '#3F5A3A', // forest
  '#7E9269', // moss
  '#B58A3B', // warm gold
  '#9C4A3A', // dusty brick
  '#5B6F4D', // olive
  '#A8B998', // soft sage
  '#8B6F4E', // bark
  '#C8A66B', // wheat
];

export default function Wheel({
  names,
  spinning,
  winnerIndex,
  onStopSpinning,
}: {
  names: string[];
  spinning: boolean;
  winnerIndex: number;
  onStopSpinning: () => void;
}) {
  const data = useMemo(
    () =>
      names.length > 0
        ? names.map((n, i) => ({
            option: n.length > 14 ? n.slice(0, 13) + '…' : n,
            style: { backgroundColor: PALETTE[i % PALETTE.length], textColor: '#F1EDE6' },
          }))
        : [{ option: 'Add people', style: { backgroundColor: '#DDE2D2', textColor: '#2A2E26' } }],
    [names]
  );

  if (names.length === 0) {
    return (
      <div className="flex items-center justify-center w-72 h-72 rounded-full bg-woodland-surface-2 text-woodland-muted text-sm">
        Select at least one person
      </div>
    );
  }

  return (
    <Roulette
      mustStartSpinning={spinning}
      prizeNumber={Math.min(winnerIndex, data.length - 1)}
      data={data}
      onStopSpinning={onStopSpinning}
      outerBorderColor="#2A2E26"
      outerBorderWidth={4}
      innerBorderColor="#2A2E26"
      radiusLineColor="#2A2E26"
      radiusLineWidth={1}
      fontSize={14}
      textDistance={62}
    />
  );
}
