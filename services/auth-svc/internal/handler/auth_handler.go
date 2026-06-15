// Package handler berisi HTTP handler auth-svc (chi).
package handler

import (
	"net/http"

	"github.com/google/uuid"

	"github.com/lumbung/auth-svc/internal/domain"
	"github.com/lumbung/auth-svc/internal/service"
	sharedauth "github.com/lumbung/shared/auth"
	apperr "github.com/lumbung/shared/errors"
	"github.com/lumbung/shared/httpx"
)

const refreshCookieName = "refresh_token"

// AuthHandler menangani endpoint /api/auth/*.
type AuthHandler struct {
	svc *service.AuthService
}

// NewAuthHandler membuat handler baru.
func NewAuthHandler(svc *service.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

type registerRequest struct {
	Username   string `json:"username"`
	Email      string `json:"email"`
	Password   string `json:"password"`
	KoperasiID string `json:"koperasi_id"`
	Role       string `json:"role"`
}

type userResponse struct {
	ID         string `json:"id"`
	Email      string `json:"email"`
	Username   string `json:"username"`
	Role       string `json:"role"`
	KoperasiID string `json:"koperasi_id,omitempty"`
}

// Register menangani POST /api/auth/register.
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, err)
		return
	}

	in := service.RegisterInput{
		Username: req.Username,
		Email:    req.Email,
		Password: req.Password,
		Role:     req.Role,
	}
	if req.KoperasiID != "" {
		kid, err := uuid.Parse(req.KoperasiID)
		if err != nil {
			httpx.WriteError(w, apperr.BadRequest("koperasi_id bukan UUID valid"))
			return
		}
		in.KoperasiID = kid
	}

	u, err := h.svc.Register(r.Context(), in)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toUserResponse(u))
}

type loginRequest struct {
	Email      string `json:"email"`
	Password   string `json:"password"`
	KoperasiID string `json:"koperasi_id"`
}

type tokenResponse struct {
	AccessToken string `json:"access_token"`
}

// Login menangani POST /api/auth/login.
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, err)
		return
	}

	in := service.LoginInput{Email: req.Email, Password: req.Password}
	if req.KoperasiID != "" {
		kid, err := uuid.Parse(req.KoperasiID)
		if err != nil {
			httpx.WriteError(w, apperr.BadRequest("koperasi_id bukan UUID valid"))
			return
		}
		in.KoperasiID = kid
	}

	pair, err := h.svc.Login(r.Context(), in)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	setRefreshCookie(w, pair.RefreshToken)
	httpx.WriteJSON(w, http.StatusOK, tokenResponse{AccessToken: pair.AccessToken})
}

// Refresh menangani POST /api/auth/refresh.
func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	c, err := r.Cookie(refreshCookieName)
	if err != nil || c.Value == "" {
		httpx.WriteError(w, apperr.Unauthorized("refresh token tidak ada"))
		return
	}
	pair, err := h.svc.Refresh(r.Context(), c.Value)
	if err != nil {
		clearRefreshCookie(w)
		httpx.WriteError(w, err)
		return
	}
	setRefreshCookie(w, pair.RefreshToken)
	httpx.WriteJSON(w, http.StatusOK, tokenResponse{AccessToken: pair.AccessToken})
}

// Logout menangani POST /api/auth/logout.
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(refreshCookieName); err == nil && c.Value != "" {
		_ = h.svc.Logout(r.Context(), c.Value)
	}
	clearRefreshCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

// GetMe menangani GET /api/auth/me (butuh identity dari header gateway).
func (h *AuthHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	id, ok := sharedauth.FromContext(r.Context())
	if !ok {
		httpx.WriteError(w, apperr.Unauthorized("identitas tidak ditemukan"))
		return
	}
	userID, err := uuid.Parse(id.UserID)
	if err != nil {
		httpx.WriteError(w, apperr.BadRequest("user ID tidak valid"))
		return
	}
	u, err := h.svc.GetMe(r.Context(), userID)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toUserResponse(u))
}

func toUserResponse(u *domain.User) userResponse {
	resp := userResponse{
		ID:       u.ID.String(),
		Email:    u.Email,
		Username: u.Username,
		Role:     u.Role,
	}
	if u.KoperasiID != uuid.Nil {
		resp.KoperasiID = u.KoperasiID.String()
	}
	return resp
}

// setRefreshCookie menulis cookie refresh_token httpOnly.
func setRefreshCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookieName,
		Value:    token,
		Path:     "/api/auth",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   7 * 24 * 3600,
	})
}

// clearRefreshCookie menghapus cookie refresh_token.
func clearRefreshCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookieName,
		Value:    "",
		Path:     "/api/auth",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   -1,
	})
}
