import { WithNull } from "@/types/mainTypes";
import { createContext, ReactNode, useState } from "react";

export interface PositionElement {
  x: number;
  y: number;
}

interface PositionsContextState {
  deckPosition: WithNull<PositionElement>;
  playersPositions: PositionElement[];
  bidsPosition: WithNull<PositionElement>;
  changeDeckPosition: (position: WithNull<PositionElement>) => void;
  changePlayersPositions: (positions: PositionElement[]) => void;
  addPlayerPosition: (position: PositionElement) => void;
  changeBidsPosition: (position: WithNull<PositionElement>) => void;
}

export const PositionsContext = createContext<PositionsContextState>({
  deckPosition: null,
  playersPositions: [],
  bidsPosition: null,
  changeDeckPosition: () => {},
  changePlayersPositions: () => {},
  addPlayerPosition: () => {},
  changeBidsPosition: () => {},
});

interface Props {
  children: ReactNode;
}

export function PositionsProvider({ children }: Props) {
  const [deckPosition, setDeckPosition] =
    useState<WithNull<PositionElement>>(null);
  const [playersPositions, setPlayersPositions] = useState<PositionElement[]>(
    []
  );
  const [bidsPosition, setBidsPosition] = useState<WithNull<PositionElement>>(null)

  const changeDeckPosition = (position: WithNull<PositionElement>) => {
    setDeckPosition(position);
  };

  const changePlayersPositions = (positions: PositionElement[]) => {
    setPlayersPositions(positions);
  };

  const addPlayerPosition = (position: PositionElement) => {
    setPlayersPositions((prev) => [...prev, position]);
  };

  const changeBidsPosition = (position: WithNull<PositionElement>) => {
    setBidsPosition(position);
  }

  return (
    <PositionsContext.Provider
      value={{
        deckPosition,
        playersPositions,
        changeDeckPosition,
        changePlayersPositions,
        addPlayerPosition,
        bidsPosition, 
        changeBidsPosition
      }}
    >
      {children}
    </PositionsContext.Provider>
  );
}
