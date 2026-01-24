import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PROPERTIES } from './monopoly-data';

export interface Player { id: string; name: string; cash: number; color: string; isBankrupt: boolean; }
export interface PropertyState { ownerId: string | null; mortgaged: boolean; houses: number; }
export interface Transaction { id: string; timestamp: number; description: string; amount?: number; from?: string; to?: string; }
export interface GameSettings { freeParkingJackpot: boolean; buyEverything: boolean; startingCash: number; bankCashMode: boolean; }

export interface GameState {
  players: Player[];
  properties: Record<string, PropertyState>;
  bank: { cash: number; houses: number; hotels: number; freeParkingPot: number; };
  settings: GameSettings;
  transactions: Transaction[];
  activePlayerId: string | null;
  turnCount: number;
  addPlayer: (name: string, color: string) => void;
  startGame: (settings: GameSettings) => void;
  resetGame: () => void;
  transferMoney: (from: string, to: string, amount: number, reason: string) => void;
  buyProperty: (playerId: string, propertyId: string, priceOverride?: number) => void;
  mortgageProperty: (propertyId: string) => void;
  unmortgageProperty: (propertyId: string) => void;
  buildHouse: (propertyId: string) => void;
  buildHouseFree: (propertyId: string) => void;
  declareBankruptcy: (playerId: string, creditorId: string) => void;
  nextTurn: () => void;
  addTransaction: (desc: string, amount?: number, from?: string, to?: string) => void;
}

const initProps = () => PROPERTIES.reduce((acc, p) => ({ ...acc, [p.id]: { ownerId: null, mortgaged: false, houses: 0 } }), {} as Record<string, PropertyState>);
const uuid = () => crypto.randomUUID();
const now = () => Date.now();

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      players: [],
      properties: initProps(),
      bank: { cash: 20580, houses: 32, hotels: 12, freeParkingPot: 0 },
      settings: { freeParkingJackpot: false, buyEverything: false, startingCash: 1500, bankCashMode: false },
      transactions: [],
      activePlayerId: null,
      turnCount: 0,

      addPlayer: (name, color) => set(s => ({
        players: [...s.players, { id: uuid(), name, cash: s.settings.startingCash, color, isBankrupt: false }]
      })),

      startGame: (settings) => set(s => ({
        settings,
        players: s.players.map(p => ({ ...p, cash: settings.startingCash })),
        properties: initProps(),
        activePlayerId: s.players[0]?.id || null,
        turnCount: 1,
        transactions: [{ id: uuid(), timestamp: now(), description: 'Game Started' }],
        bank: { cash: 20580, houses: 32, hotels: 12, freeParkingPot: 0 }
      })),

      resetGame: () => set({ players: [], properties: initProps(), transactions: [], activePlayerId: null, turnCount: 0 }),

      addTransaction: (description, amount, from, to) => set(s => ({
        transactions: [{ id: uuid(), timestamp: now(), description, amount, from, to }, ...s.transactions]
      })),

      transferMoney: (fromId, toId, amount, reason) => set(s => {
        let players = [...s.players], bank = { ...s.bank };
        const getName = (id: string) => id === 'BANK' ? 'The Bank' : id === 'FREE_PARKING' ? 'Free Parking' : s.players.find(p => p.id === id)?.name || 'Unknown';
        
        if (fromId === 'BANK') { if (s.settings.bankCashMode) bank.cash -= amount; }
        else if (fromId === 'FREE_PARKING') bank.freeParkingPot = 0;
        else players = players.map(p => p.id === fromId ? { ...p, cash: p.cash - amount } : p);

        if (toId === 'BANK') { if (s.settings.bankCashMode) bank.cash += amount; }
        else if (toId === 'FREE_PARKING') bank.freeParkingPot += amount;
        else players = players.map(p => p.id === toId ? { ...p, cash: p.cash + amount } : p);

        return {
          players, bank,
          transactions: [{ id: uuid(), timestamp: now(), description: `${reason}: ${getName(fromId)} paid $${amount} to ${getName(toId)}`, amount, from: fromId, to: toId }, ...s.transactions]
        };
      }),

      buyProperty: (playerId, propertyId, priceOverride) => set(s => {
        const prop = PROPERTIES.find(p => p.id === propertyId);
        const player = s.players.find(p => p.id === playerId);
        if (!prop || !player) return s;
        const price = priceOverride ?? prop.price;
        return {
          players: s.players.map(p => p.id === playerId ? { ...p, cash: p.cash - price } : p),
          properties: { ...s.properties, [propertyId]: { ...s.properties[propertyId], ownerId: playerId } },
          transactions: [{ id: uuid(), timestamp: now(), description: `${player.name} bought ${prop.name} for $${price}`, amount: price, from: playerId, to: 'BANK' }, ...s.transactions]
        };
      }),

      mortgageProperty: (propertyId) => set(s => {
        const prop = PROPERTIES.find(p => p.id === propertyId);
        const ps = s.properties[propertyId];
        const owner = s.players.find(p => p.id === ps.ownerId);
        if (!prop || !owner) return s;
        return {
          players: s.players.map(p => p.id === owner.id ? { ...p, cash: p.cash + prop.mortgageValue } : p),
          properties: { ...s.properties, [propertyId]: { ...ps, mortgaged: true } },
          transactions: [{ id: uuid(), timestamp: now(), description: `${owner.name} mortgaged ${prop.name} for $${prop.mortgageValue}`, amount: prop.mortgageValue, from: 'BANK', to: owner.id }, ...s.transactions]
        };
      }),

      unmortgageProperty: (propertyId) => set(s => {
        const prop = PROPERTIES.find(p => p.id === propertyId);
        const ps = s.properties[propertyId];
        const owner = s.players.find(p => p.id === ps.ownerId);
        if (!prop || !owner) return s;
        const cost = Math.ceil(prop.mortgageValue * 1.1);
        return {
          players: s.players.map(p => p.id === owner.id ? { ...p, cash: p.cash - cost } : p),
          properties: { ...s.properties, [propertyId]: { ...ps, mortgaged: false } },
          transactions: [{ id: uuid(), timestamp: now(), description: `${owner.name} unmortgaged ${prop.name} for $${cost}`, amount: cost, from: owner.id, to: 'BANK' }, ...s.transactions]
        };
      }),

      buildHouse: (propertyId) => set(s => {
        const prop = PROPERTIES.find(p => p.id === propertyId);
        const ps = s.properties[propertyId];
        const owner = s.players.find(p => p.id === ps.ownerId);
        if (!prop || !owner || ps.houses >= 5) return s;
        const isHotel = ps.houses === 4;
        const bank = { ...s.bank, houses: isHotel ? s.bank.houses + 4 : s.bank.houses - 1, hotels: isHotel ? s.bank.hotels - 1 : s.bank.hotels };
        return {
          players: s.players.map(p => p.id === owner.id ? { ...p, cash: p.cash - prop.houseCost } : p),
          properties: { ...s.properties, [propertyId]: { ...ps, houses: ps.houses + 1 } },
          bank,
          transactions: [{ id: uuid(), timestamp: now(), description: `${owner.name} built a ${isHotel ? 'Hotel' : 'House'} on ${prop.name}`, amount: prop.houseCost, from: owner.id, to: 'BANK' }, ...s.transactions]
        };
      }),

      buildHouseFree: (propertyId) => set(s => {
        const prop = PROPERTIES.find(p => p.id === propertyId);
        const ps = s.properties[propertyId];
        const owner = s.players.find(p => p.id === ps.ownerId);
        if (!prop || !owner || ps.houses >= 5) return s;
        const isHotel = ps.houses === 4;
        return {
          properties: { ...s.properties, [propertyId]: { ...ps, houses: ps.houses + 1 } },
          bank: { ...s.bank, houses: isHotel ? s.bank.houses + 4 : s.bank.houses - 1, hotels: isHotel ? s.bank.hotels - 1 : s.bank.hotels },
          transactions: [{ id: uuid(), timestamp: now(), description: `${owner.name} built a ${isHotel ? 'Hotel' : 'House'} on ${prop.name} (FREE)` }, ...s.transactions]
        };
      }),

      declareBankruptcy: (playerId, creditorId) => set(s => {
        const player = s.players.find(p => p.id === playerId);
        if (!player) return s;
        const playerProps = Object.entries(s.properties).filter(([, ps]) => ps.ownerId === playerId).map(([id]) => id);
        let props = { ...s.properties }, players = [...s.players];

        if (creditorId === 'BANK') {
          playerProps.forEach(id => { props[id] = { ownerId: null, mortgaged: false, houses: 0 }; });
        } else {
          playerProps.forEach(id => { props[id] = { ...props[id], ownerId: creditorId }; });
          players = players.map(p => p.id === creditorId ? { ...p, cash: p.cash + player.cash } : p);
        }
        players = players.map(p => p.id === playerId ? { ...p, isBankrupt: true, cash: 0 } : p);
        const creditorName = creditorId === 'BANK' ? 'The Bank' : s.players.find(p => p.id === creditorId)?.name || 'Unknown';
        return {
          players, properties: props,
          transactions: [{ id: uuid(), timestamp: now(), description: `${player.name} declared bankruptcy! Assets to ${creditorName}.` }, ...s.transactions]
        };
      }),

      nextTurn: () => set(s => {
        const idx = s.players.findIndex(p => p.id === s.activePlayerId);
        const next = s.players[(idx + 1) % s.players.length];
        return {
          activePlayerId: next.id,
          turnCount: s.turnCount + 1,
          transactions: [{ id: uuid(), timestamp: now(), description: `Start of ${next.name}'s turn` }, ...s.transactions]
        };
      })
    }),
    { name: 'monopoly-storage' }
  )
);
