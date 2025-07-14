package client

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"strings"
	"sync"
	"time"
)

type SMTPClient struct {
	conn     net.Conn
	host     string
	port     string
	reader   *bufio.Reader
	writer   *bufio.Writer
	response chan string
	mu       sync.Mutex
}

func NewSMTPClient() *SMTPClient {
	host := os.Getenv("HOST")
	port := os.Getenv("PORT")
	if host == "" {
		host = "localhost"
	}
	if port == "" {
		port = "2525"
	}

	return &SMTPClient{
		host:     host,
		port:     port,
		response: make(chan string, 10),
	}
}

func (c *SMTPClient) Connect(ctx context.Context) error {
	conn, err := net.Dial("tcp", fmt.Sprintf("%s:%s", c.host, c.port))
	if err != nil {
		return err
	}
	c.conn = conn
	c.reader = bufio.NewReader(conn)
	c.writer = bufio.NewWriter(conn)

	line, err := c.readResponse(ctx)
	if err != nil {
		return err
	}
	if !strings.HasPrefix(line, "220") {
		return fmt.Errorf("connection refused: %s", line)
	}
	return nil
}

func (c *SMTPClient) readResponse(ctx context.Context) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	line, err := c.reader.ReadString('\n')
	if err != nil {
		return "", err
	}
	line = strings.TrimSpace(line)
	fmt.Println("SMTP <<<", line)
	return line, nil
}

func (c *SMTPClient) sendCommand(ctx context.Context, cmd string) (string, error) {
	fmt.Println("SMTP >>>", cmd)
	if _, err := c.writer.WriteString(cmd + "\r\n"); err != nil {
		return "", err
	}
	if err := c.writer.Flush(); err != nil {
		return "", err
	}
	return c.readResponse(ctx)
}

func (c *SMTPClient) SendMail(sender, recipient, message string) error {
	ctx := context.Background()

	res, err := c.sendCommand(ctx, "EHLO localhost")
	if err != nil || !strings.HasPrefix(res, "250") {
		return errors.New("EHLO failed: " + res)
	}

	res, err = c.sendCommand(ctx, fmt.Sprintf("MAIL FROM:<%s>", sender))
	if err != nil || !strings.HasPrefix(res, "250") {
		return errors.New("MAIL FROM failed: " + res)
	}

	res, err = c.sendCommand(ctx, fmt.Sprintf("RCPT TO:<%s>", recipient))
	if err != nil || !strings.HasPrefix(res, "250") {
		return errors.New("RCPT TO failed: " + res)
	}

	res, err = c.sendCommand(ctx, "DATA")
	if err != nil || !strings.HasPrefix(res, "354") {
		return errors.New("DATA command failed: " + res)
	}

	msg := strings.ReplaceAll(message, "\n", "\r\n") + "\r\n.\r\n"
	if _, err := c.writer.WriteString(msg); err != nil {
		return err
	}
	if err := c.writer.Flush(); err != nil {
		return err
	}

	res, err = c.readResponse(ctx)
	if err != nil || !strings.HasPrefix(res, "250") {
		return errors.New("Message not accepted: " + res)
	}

	res, err = c.sendCommand(ctx, "QUIT")
	if err != nil || !strings.HasPrefix(res, "221") {
		return errors.New("QUIT failed: " + res)
	}

	c.conn.Close()
	return nil
}
