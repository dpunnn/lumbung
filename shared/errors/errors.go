// Package errors mendefinisikan AppError — tipe error domain yang membawa
// kode mesin, pesan manusia, dan status HTTP. Tujuannya respon error konsisten
// di semua service: { "error": { "code": "...", "message": "..." } }.
package errors

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
)

// Code adalah kode error mesin (stabil, dipakai frontend untuk branching).
type Code string

const (
	CodeBadRequest   Code = "BAD_REQUEST"
	CodeUnauthorized Code = "UNAUTHORIZED"
	CodeForbidden    Code = "FORBIDDEN"
	CodeNotFound     Code = "NOT_FOUND"
	CodeConflict     Code = "CONFLICT"
	CodeValidation   Code = "VALIDATION_ERROR"
	CodeTenantMissing Code = "TENANT_MISSING"
	CodeInternal     Code = "INTERNAL"
	CodeUnavailable  Code = "SERVICE_UNAVAILABLE"
)

// AppError adalah error domain yang aman dikirim ke klien.
type AppError struct {
	ErrCode    Code   // kode mesin
	Message    string // pesan untuk klien (bahasa Indonesia, aman ditampilkan)
	HTTPStatus int    // status HTTP yang akan ditulis
	cause      error  // error asli untuk logging internal (tidak dikirim ke klien)
}

// Error mengimplementasikan interface error.
func (e *AppError) Error() string {
	if e.cause != nil {
		return fmt.Sprintf("%s: %s (cause: %v)", e.ErrCode, e.Message, e.cause)
	}
	return fmt.Sprintf("%s: %s", e.ErrCode, e.Message)
}

// Unwrap mengembalikan error penyebab agar kompatibel dengan errors.Is/As.
func (e *AppError) Unwrap() error { return e.cause }

// WithCause melampirkan error penyebab (untuk log internal), mengembalikan *AppError baru.
func (e *AppError) WithCause(err error) *AppError {
	clone := *e
	clone.cause = err
	return &clone
}

// New membuat AppError baru.
func New(code Code, status int, message string) *AppError {
	return &AppError{ErrCode: code, Message: message, HTTPStatus: status}
}

// Konstruktor cepat untuk error umum -------------------------------------------------

func BadRequest(msg string) *AppError   { return New(CodeBadRequest, http.StatusBadRequest, msg) }
func Unauthorized(msg string) *AppError { return New(CodeUnauthorized, http.StatusUnauthorized, msg) }
func Forbidden(msg string) *AppError    { return New(CodeForbidden, http.StatusForbidden, msg) }
func NotFound(msg string) *AppError     { return New(CodeNotFound, http.StatusNotFound, msg) }
func Conflict(msg string) *AppError     { return New(CodeConflict, http.StatusConflict, msg) }
func Validation(msg string) *AppError   { return New(CodeValidation, http.StatusUnprocessableEntity, msg) }
func TenantMissing() *AppError {
	return New(CodeTenantMissing, http.StatusBadRequest, "tenant_id tidak ditemukan pada konteks request")
}
func Internal(msg string) *AppError {
	return New(CodeInternal, http.StatusInternalServerError, msg)
}
func Unavailable(msg string) *AppError {
	return New(CodeUnavailable, http.StatusServiceUnavailable, msg)
}

// errorBody adalah bentuk JSON yang dikirim ke klien.
type errorBody struct {
	Error errorDetail `json:"error"`
}
type errorDetail struct {
	Code    Code   `json:"code"`
	Message string `json:"message"`
}

// Write menulis sebuah error ke ResponseWriter dalam format JSON konsisten.
// Jika err bukan *AppError, dibungkus sebagai INTERNAL 500 (pesan asli disembunyikan).
func Write(w http.ResponseWriter, err error) {
	appErr := AsAppError(err)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(appErr.HTTPStatus)
	_ = json.NewEncoder(w).Encode(errorBody{
		Error: errorDetail{Code: appErr.ErrCode, Message: appErr.Message},
	})
}

// AsAppError mengkonversi error apa pun menjadi *AppError.
// Error yang tidak dikenal menjadi INTERNAL agar detail internal tidak bocor.
func AsAppError(err error) *AppError {
	if err == nil {
		return Internal("unknown error")
	}
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr
	}
	return Internal("terjadi kesalahan internal").WithCause(err)
}

// Is mengecek apakah err merupakan AppError dengan kode tertentu.
func Is(err error, code Code) bool {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr.ErrCode == code
	}
	return false
}
