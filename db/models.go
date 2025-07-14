package db

import (
	"context"
	"errors"
	"time"
)

type User struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

// FetchUserByEmail returns the first user with matching email
func FetchUserByEmail(ctx context.Context, email string) (*User, error) {
	var user User

	err := Pool.QueryRow(ctx, `
		SELECT id, name, email, password
		FROM users
		WHERE email = $1
		LIMIT 1
	`, email).Scan(&user.ID, &user.Name, &user.Email, &user.Password)

	if err != nil {
		return nil, errors.New("user not found or query failed")
	}

	return &user, nil
}

// For timeout safety
func TimeoutContext() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 3*time.Second)
}
