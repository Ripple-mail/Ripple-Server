package smtp

import (
	"fmt"
	"regexp"
	"strings"
)

func HandleCommand(session *SMTPSession, line string) {
	parts := strings.SplitN(line, " ", 2)
	cmd := strings.ToUpper(parts[0])
	args := ""
	if len(parts) > 1 {
		args = parts[1]
	}

	write := func(msg string) {
		session.Conn.Write([]byte(msg))
	}

	switch cmd {
	case "HELO", "EHLO":
		if args == "" {
			write("501 Syntax: HELO/EHLO hostname\r\n")
			return
		}
		session.Hello = args
		write(fmt.Sprintf("250 Hello %s\r\n", args))
	case "MAIL":
		if !strings.HasPrefix(strings.ToUpper(line), "MAIL FROM:") {
			write("501 Syntax error in parameters or arguments\r\n")
			return
		}
		if session.Hello == "" {
			write("503 Send HELO/EHLO first\r\n")
			return
		}
		addr := extractAddress(line)
		if addr == "" {
			write("510 Syntax error: Invalid email address\r\n")
			return
		}
		session.MailFrom = addr
		write("250 OK\r\n")
	case "RCPT":
		if !strings.HasPrefix(strings.ToUpper(line), "RCPT TO:") {
			write("501 Syntax error in parameters or arguments\r\n")
			return
		}
		if session.MailFrom == "" {
			write("503 Need MAIL command first\r\n")
			return
		}
		addr := extractAddress(line)
		if addr == "" {
			write("510 Syntax error: Invalid email address\r\n")
			return
		}
		session.RcptTo = addr
		write("250 OK\r\n")
	case "DATA":
		if session.MailFrom == "" || session.RcptTo == "" {
			write("503 Need MAIL FROM and RCPT TO first\r\n")
			return
		}
		session.CollectingData = true
		session.DataLines = []string{}
		write("354 Start mail input; end with <CRLF>.<CRLF>\r\n")
	case "NOOP":
		write("250 OK\r\n")
	case "HELP":
		write("214 Commands supported: HELO EHLO MAIL RCPT DATA RSET NOOP QUIT\r\n")
	case "VRFY", "EXPN", "AUTH":
		write("502 Command not implemented\r\n")
	case "RSET":
		session.Reset()
		write("250 OK\r\n")
	case "STARTTLS":
		session.Reset()
		write("220 Ready to start TLS\r\n")
	case "QUIT":
		write("221 Bye\r\n")
		session.Conn.Close()
	default:
		write("502 Command not implemented\r\n")
	}
}

func extractAddress(line string) string {
	re := regexp.MustCompile(`<([^>]+)>`)
	match := re.FindStringSubmatch(line)
	if len(match) < 2 {
		return ""
	}
	return match[1]
}
