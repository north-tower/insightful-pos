import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
  ReactNode,
} from 'react';
import { useAuth } from '@/context/AuthContext';
import { MenuItem } from '@/data/menuData';
import { OrderModifier, CartItemWithModifiers, HeldOrder } from '@/data/orderData';

export interface CartItem extends MenuItem {
  quantity: number;
  modifiers?: OrderModifier[];
  notes?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: MenuItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  updateItemNotes: (id: string, notes: string) => void;
  addItemModifier: (itemId: string, modifier: OrderModifier) => void;
  removeItemModifier: (itemId: string, modifierId: string) => void;
  totalItems: number;
  subtotal: number;
  tax: number;
  total: number;
  orderNotes?: string;
  setOrderNotes: (notes: string) => void;
  heldOrders: HeldOrder[];
  holdOrder: (name: string) => void;
  loadHeldOrder: (orderId: string) => void;
  deleteHeldOrder: (orderId: string) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const RESTAURANT_CART_V = 1 as const;

interface PersistedRestaurantCart {
  v: typeof RESTAURANT_CART_V;
  items: CartItem[];
  orderNotes: string;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const restaurantCartStorageKey = useMemo(
    () => `insightful-pos:v1:restaurant-cart:${user?.id ?? 'guest'}`,
    [user?.id],
  );

  const [items, setItems] = useState<CartItem[]>([]);
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);

  const restaurantCartHydratedRef = useRef(false);
  const restaurantStorageKeySeenRef = useRef<string | null>(null);
  const [restaurantCartPersistenceReady, setRestaurantCartPersistenceReady] =
    useState(false);

  useEffect(() => {
    if (restaurantStorageKeySeenRef.current === null) {
      restaurantStorageKeySeenRef.current = restaurantCartStorageKey;
      return;
    }
    if (restaurantStorageKeySeenRef.current === restaurantCartStorageKey) return;
    restaurantStorageKeySeenRef.current = restaurantCartStorageKey;
    setItems([]);
    setOrderNotes('');
    restaurantCartHydratedRef.current = false;
    setRestaurantCartPersistenceReady(false);
  }, [restaurantCartStorageKey]);

  useEffect(() => {
    if (restaurantCartHydratedRef.current) return;
    restaurantCartHydratedRef.current = true;

    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(restaurantCartStorageKey);
        if (raw) {
          const data = JSON.parse(raw) as Partial<PersistedRestaurantCart>;
          if (data?.v === RESTAURANT_CART_V && Array.isArray(data.items)) {
            setItems(data.items as CartItem[]);
          }
          if (typeof data?.orderNotes === 'string') {
            setOrderNotes(data.orderNotes);
          }
        }
      }
    } catch {
      /* ignore corrupt storage */
    } finally {
      setRestaurantCartPersistenceReady(true);
    }
  }, [restaurantCartStorageKey]);

  useEffect(() => {
    if (!restaurantCartPersistenceReady || typeof window === 'undefined') return;
    try {
      if (items.length === 0 && !orderNotes.trim()) {
        localStorage.removeItem(restaurantCartStorageKey);
        return;
      }
      const payload: PersistedRestaurantCart = {
        v: RESTAURANT_CART_V,
        items,
        orderNotes,
      };
      localStorage.setItem(restaurantCartStorageKey, JSON.stringify(payload));
    } catch {
      /* ignore quota / private mode */
    }
  }, [items, orderNotes, restaurantCartPersistenceReady, restaurantCartStorageKey]);

  const addItem = (item: MenuItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id && !i.notes && (!i.modifiers || i.modifiers.length === 0));
      if (existing) {
        return prev.map((i) =>
          i.id === item.id && !i.notes && (!i.modifiers || i.modifiers.length === 0)
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity } : i))
    );
  };

  const updateItemNotes = (id: string, notes: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, notes } : i))
    );
  };

  const addItemModifier = (itemId: string, modifier: OrderModifier) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, modifiers: [...(i.modifiers || []), modifier] }
          : i
      )
    );
  };

  const removeItemModifier = (itemId: string, modifierId: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, modifiers: (i.modifiers || []).filter((m) => m.id !== modifierId) }
          : i
      )
    );
  };

  const clearCart = () => {
    setItems([]);
    setOrderNotes('');
  };

  const holdOrder = (name: string) => {
    const heldOrder: HeldOrder = {
      id: Date.now().toString(),
      name,
      items: items as CartItemWithModifiers[],
      subtotal,
      tax,
      total,
      savedAt: new Date(),
    };
    setHeldOrders((prev) => [...prev, heldOrder]);
    clearCart();
  };

  const loadHeldOrder = (orderId: string) => {
    const order = heldOrders.find((o) => o.id === orderId);
    if (order) {
      setItems(order.items as CartItem[]);
    }
  };

  const deleteHeldOrder = (orderId: string) => {
    setHeldOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  const calculateItemTotal = (item: CartItem) => {
    const itemBase = item.price * item.quantity;
    const modifierTotal = (item.modifiers || []).reduce((sum, m) => sum + (m.price || 0) * item.quantity, 0);
    return itemBase + modifierTotal;
  };

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + calculateItemTotal(i), 0);
  const tax = 0;
  const total = subtotal;

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        updateItemNotes,
        addItemModifier,
        removeItemModifier,
        totalItems,
        subtotal,
        tax,
        total,
        orderNotes,
        setOrderNotes,
        heldOrders,
        holdOrder,
        loadHeldOrder,
        deleteHeldOrder,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
