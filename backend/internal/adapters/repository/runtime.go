package repository

import (
	"time"

	"github.com/google/uuid"
)

type RuntimeClock struct{}

func (RuntimeClock) Now() time.Time {
	return time.Now().UTC()
}

type UUIDGenerator struct{}

func (UUIDGenerator) NewID() string {
	return uuid.NewString()
}
