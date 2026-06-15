package hub

import "sync"

type Hub struct {
	mu          sync.RWMutex
	subscribers map[string][]chan any
}

func New() *Hub {
	return &Hub{subscribers: make(map[string][]chan any)}
}

func (h *Hub) Subscribe(tenantID string) chan any {
	ch := make(chan any, 10)
	h.mu.Lock()
	h.subscribers[tenantID] = append(h.subscribers[tenantID], ch)
	h.mu.Unlock()
	return ch
}

func (h *Hub) Unsubscribe(tenantID string, ch chan any) {
	h.mu.Lock()
	defer h.mu.Unlock()
	chs := h.subscribers[tenantID]
	for i, c := range chs {
		if c == ch {
			h.subscribers[tenantID] = append(chs[:i], chs[i+1:]...)
			break
		}
	}
	close(ch)
}

func (h *Hub) Broadcast(tenantID string, msg any) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, ch := range h.subscribers[tenantID] {
		select {
		case ch <- msg:
		default:
		}
	}
}
