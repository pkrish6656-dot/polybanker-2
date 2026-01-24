import { useState } from "react";
import { useGameStore } from "@/lib/game-store";
import { PROPERTIES, STANDARD_PROPERTIES, Property } from "@/lib/monopoly-data";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { ArrowRightLeft, Building2, Coins, DollarSign, HandCoins, Home, RefreshCcw, Skull } from "lucide-react";
import { cn } from "@/lib/utils";

type ActionType = 'pass_go' | 'pay' | 'receive' | 'buy' | 'rent' | 'build' | 'bankruptcy' | null;

const ACTIONS = [
  { id: 'pass_go', label: 'Pass GO', icon: RefreshCcw, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { id: 'pay', label: 'Pay', icon: ArrowRightLeft, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { id: 'receive', label: 'Receive', icon: HandCoins, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { id: 'buy', label: 'Buy Prop', icon: Home, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  { id: 'rent', label: 'Pay Rent', icon: Coins, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  { id: 'build', label: 'Build', icon: Building2, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { id: 'bankruptcy', label: 'Bankrupt', icon: Skull, color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400' },
] as const;

const ACTION_TITLES: Record<string, string> = {
  pass_go: "Pass GO", pay: "Pay Money", receive: "Receive Money", buy: "Buy Property",
  rent: "Pay Rent", build: "Build House/Hotel", bankruptcy: "Declare Bankruptcy"
};

const COLOR_MAP: Record<string, string> = {
  brown: 'bg-amber-900', lightBlue: 'bg-sky-400', pink: 'bg-pink-500', orange: 'bg-orange-500',
  red: 'bg-red-600', yellow: 'bg-yellow-400', green: 'bg-green-600', blue: 'bg-blue-800'
};

export function ActionDrawer({ activePlayer }: { activePlayer: any }) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<ActionType>(null);
  const nextTurn = useGameStore(s => s.nextTurn);

  if (!activePlayer) return null;
  const close = () => { setOpen(false); setAction(null); };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button size="lg" className="w-full shadow-xl text-lg h-14 font-bold bg-primary text-primary-foreground hover:bg-primary/90">
          <DollarSign className="w-5 h-5 mr-2" /> Take Action
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-[85vh]">
        <div className="mx-auto w-full max-w-sm h-full flex flex-col">
          <DrawerHeader>
            <DrawerTitle className="text-2xl font-serif text-center">
              {action ? ACTION_TITLES[action] : `${activePlayer.name}'s Turn`}
            </DrawerTitle>
            <DrawerDescription className="text-center">
              {action ? "Fill in the details below" : "Choose an action"}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 px-4 overflow-y-auto">
            {!action ? (
              <div className="grid grid-cols-2 gap-4 pt-4">
                {ACTIONS.map(a => (
                  <button key={a.id} onClick={() => setAction(a.id as ActionType)}
                    className={cn("flex flex-col items-center justify-center p-6 rounded-xl transition-all active:scale-95 border-2 border-transparent hover:border-border hover:bg-secondary/50", a.color)}>
                    <a.icon className="w-8 h-8 mb-3" />
                    <span className="font-bold text-lg">{a.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <ActionForm type={action} player={activePlayer} onBack={() => setAction(null)} onComplete={close} />
            )}
          </div>
          <DrawerFooter>
            {!action && <Button variant="destructive" className="w-full h-12 text-lg" onClick={() => { nextTurn(); close(); }}>End Turn</Button>}
            <DrawerClose asChild><Button variant="outline">Close</Button></DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function ActionForm({ type, player, onBack, onComplete }: { type: ActionType, player: any, onBack: () => void, onComplete: () => void }) {
  const { transferMoney, buyProperty, players, properties, buildHouse, buildHouseFree, settings, declareBankruptcy } = useGameStore();
  const [amount, setAmount] = useState("");
  const [targetId, setTargetId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [creditorId, setCreditorId] = useState("");

  const availableProps = settings.buyEverything ? PROPERTIES : STANDARD_PROPERTIES;
  const otherPlayers = players.filter((p: any) => p.id !== player.id);

  const handleSubmit = () => {
    const val = parseInt(amount);
    if (type === 'pass_go') transferMoney('BANK', player.id, 200, "Passed GO");
    else if (type === 'pay' && val && targetId) transferMoney(player.id, targetId, val, "Payment");
    else if (type === 'receive' && val && sourceId) transferMoney(sourceId, player.id, val, "Received");
    else if (type === 'buy' && propertyId) {
      const price = PROPERTIES.find(p => p.id === propertyId)?.price || 0;
      buyProperty(player.id, propertyId, isFree ? 0 : price);
    }
    else if (type === 'rent' && val && targetId) transferMoney(player.id, targetId, val, "Rent");
    else if (type === 'build' && propertyId) isFree ? buildHouseFree(propertyId) : buildHouse(propertyId);
    else if (type === 'bankruptcy' && creditorId) declareBankruptcy(player.id, creditorId);
    else return;
    onComplete();
  };

  const AmountInput = ({ autoFocus = false }: { autoFocus?: boolean }) => (
    <div className="space-y-2">
      <Label className="text-lg">Amount</Label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">$</span>
        <Input type="number" className="pl-8 h-14 text-2xl font-mono" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} autoFocus={autoFocus} />
      </div>
    </div>
  );

  const PlayerSelect = ({ label, value, onChange, includeBank = false }: { label: string, value: string, onChange: (v: string) => void, includeBank?: boolean }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select onValueChange={onChange}>
        <SelectTrigger className="h-12"><SelectValue placeholder="Select..." /></SelectTrigger>
        <SelectContent>
          {includeBank && <><SelectItem value="BANK">The Bank</SelectItem><SelectItem value="FREE_PARKING">Free Parking</SelectItem></>}
          {(type === 'bankruptcy' ? players.filter((p: any) => p.id !== player.id && !p.isBankrupt) : otherPlayers).map((p: any) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const PropertySelect = ({ filter }: { filter: (p: Property) => boolean }) => (
    <div className="space-y-2">
      <Label>Which Property?</Label>
      <Select onValueChange={setPropertyId}>
        <SelectTrigger className="h-12"><SelectValue placeholder="Select..." /></SelectTrigger>
        <SelectContent>
          <ScrollArea className="h-[200px]">
            {availableProps.filter(filter).map((p: Property) => (
              <SelectItem key={p.id} value={p.id}>
                <span className={cn("inline-block w-3 h-3 rounded-full mr-2", COLOR_MAP[p.color] || 'bg-gray-500')} />
                {p.name} {type === 'buy' ? `($${p.price})` : `($${p.houseCost})`}
              </SelectItem>
            ))}
          </ScrollArea>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6 pt-4">
      {(type === 'buy' || type === 'build') && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-accent/10 border border-accent/20">
          <div className="space-y-0.5">
            <Label className="text-base text-accent font-bold">{type === 'buy' ? 'Free Acquisition' : 'Build for Free'}</Label>
            <p className="text-xs text-muted-foreground italic">{type === 'buy' ? 'Acquire for $0 (House Rules)' : 'Build without paying'}</p>
          </div>
          <Switch checked={isFree} onCheckedChange={setIsFree} />
        </div>
      )}
      {['pay', 'rent'].includes(type!) && <><AmountInput autoFocus /><PlayerSelect label="To Whom?" value={targetId} onChange={setTargetId} includeBank /></>}
      {type === 'receive' && <><AmountInput autoFocus /><PlayerSelect label="From Whom?" value={sourceId} onChange={setSourceId} includeBank /></>}
      {type === 'buy' && <PropertySelect filter={p => !properties[p.id]?.ownerId} />}
      {type === 'build' && <PropertySelect filter={p => properties[p.id]?.ownerId === player.id && p.houseCost > 0} />}
      {type === 'bankruptcy' && (
        <>
          <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
            <p className="text-destructive font-bold text-center">{player.name} is declaring bankruptcy!</p>
            <p className="text-sm text-muted-foreground text-center mt-2">All properties and cash will be transferred.</p>
          </div>
          <PlayerSelect label="Owed To (Creditor)" value={creditorId} onChange={setCreditorId} includeBank />
        </>
      )}
      <div className="flex gap-3 pt-4">
        <Button variant="outline" className="flex-1 h-12" onClick={onBack}>Back</Button>
        <Button className="flex-1 h-12 text-lg font-bold" onClick={handleSubmit}>Confirm</Button>
      </div>
    </div>
  );
}
