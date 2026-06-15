//go:build ignore

// hash_password.go — generate hash bcrypt untuk akun seed dev.
//
// Pakai:
//   go run scripts/hash_password.go            # hash "lumbung123" (default)
//   go run scripts/hash_password.go rahasiaku  # hash argumen pertama
//
// Output bisa dipakai untuk UPDATE seed:
//   UPDATE users SET password_hash = '<output>' WHERE email LIKE '%.test';

package main

import (
	"fmt"
	"os"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	password := "lumbung123"
	if len(os.Args) > 1 {
		password = os.Args[1]
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
	fmt.Println(string(hash))
}
