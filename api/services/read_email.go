package services

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type Email struct {
	Filename string `json:"filename"`
	Path     string `json:"path"`
	Content  string `json:"content"`
	Unread   bool   `json:"unread"`
}

type EmailDetail struct {
	Filename string `json:"filename"`
	FilePath string `json:"filePath"`
	Content  string `json:"content"`
	Unread   bool   `json:"unread"`
}

var mailDir = "maildir"

func ReadMailDir(user string) ([]Email, error) {
	userDir := filepath.Join(mailDir, user)
	newDir := filepath.Join(userDir, "new")
	curDir := filepath.Join(userDir, "cur")

	readEmails := func(dir string, unread bool) ([]Email, error) {
		var emails []Email
		entries, err := os.ReadDir(dir)
		if err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				return []Email{}, nil
			}
			return nil, err
		}

		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			path := filepath.Join(dir, entry.Name())
			content, err := os.ReadFile(path)
			if err != nil {
				continue
			}
			emails = append(emails, Email{
				Filename: entry.Name(),
				Path:     path,
				Content:  string(content),
				Unread:   unread,
			})
		}

		return emails, nil
	}

	nEmails, err := readEmails(newDir, true)
	if err != nil {
		return nil, err
	}
	cEmails, err := readEmails(curDir, false)
	if err != nil {
		return nil, err
	}

	emails := append(nEmails, cEmails...)
	sort.SliceStable(emails, func(i, j int) bool {
		return emails[i].Filename > emails[j].Filename
	})
	return emails, nil
}

func ReadEmail(user, timestamp string) (*EmailDetail, error) {
	userDir := filepath.Join(mailDir, user)
	newDir := filepath.Join(userDir, "new")
	curDir := filepath.Join(userDir, "cur")

	findFile := func(dir string) (string, error) {
		entries, err := os.ReadDir(dir)
		if err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				return "", nil
			}
			return "", err
		}
		for _, entry := range entries {
			if strings.HasPrefix(entry.Name(), timestamp) {
				return filepath.Join(dir, entry.Name()), nil
			}
		}
		return "", nil
	}

	filePath, err := findFile(newDir)
	unread := false
	if err != nil {
		return nil, err
	}

	if filePath != "" {
		unread = true
		filename := filepath.Base(filePath)
		destPath := filepath.Join(curDir, filename)
		if err := os.MkdirAll(curDir, 0755); err != nil {
			return nil, err
		}
		if err := os.Rename(filePath, destPath); err != nil {
			return nil, err
		}
		filePath = destPath
	} else {
		filePath, err = findFile(curDir)
		if err != nil {
			return nil, err
		}
		if filePath == "" {
			return nil, nil
		}
	}

	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	return &EmailDetail{
		Filename: filepath.Base(filePath),
		FilePath: filePath,
		Content:  string(content),
		Unread:   unread,
	}, nil
}
