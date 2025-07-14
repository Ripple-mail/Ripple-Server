package smtp

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const MAILBOX_DIR = "maildir"
const MAILDOMAIN_PREFIX = "~"

func ensureMaildirStructure(userDir string) error {
	for _, sub := range []string{"tmp", "new", "cur"} {
		dir := filepath.Join(userDir, sub)
		if _, err := os.Stat(dir); os.IsNotExist(err) {
			if err := os.MkdirAll(dir, 0755); err != nil {
				return err
			}
		}
	}
	return nil
}

func generateMailFilename() (string, error) {
	timestamp := time.Now().UnixNano()
	randomBytes := make([]byte, 6)
	_, err := rand.Read(randomBytes)
	if err != nil {
		return "", err
	}
	randomHex := hex.EncodeToString(randomBytes)
	pid := os.Getpid()
	hostname, _ := os.Hostname()

	return fmt.Sprintf("%d.%d.%s.%s", timestamp, pid, hostname, randomHex), nil
}

func SaveEmail(recipient string, data string) error {
	parts := strings.Split(recipient, MAILDOMAIN_PREFIX)
	if len(parts) == 0 {
		return fmt.Errorf("invalid recipient format")
	}
	localPart := parts[0]
	userDir := filepath.Join(MAILBOX_DIR, localPart)

	if err := ensureMaildirStructure(userDir); err != nil {
		return err
	}

	filename, err := generateMailFilename()
	if err != nil {
		return err
	}

	tmpPath := filepath.Join(userDir, "tmp", filename)
	newPath := filepath.Join(userDir, "new", filename)

	if err := os.WriteFile(tmpPath, []byte(data), 0644); err != nil {
		return err
	}

	if err := os.Rename(tmpPath, newPath); err != nil {
		return err
	}

	fmt.Printf("Saved email to %s\n", newPath)
	return nil
}
