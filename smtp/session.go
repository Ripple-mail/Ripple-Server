package smtp

import "net"

type SMTPSession struct {
	Conn           net.Conn
	Hello          string
	MailFrom       string
	RcptTo         string
	CollectingData bool
	DataLines      []string
}

func NewSMTPSession(conn net.Conn) *SMTPSession {
	return &SMTPSession{
		Conn: conn,
	}
}

func (s *SMTPSession) Reset() {
	s.Hello = ""
	s.MailFrom = ""
	s.RcptTo = ""
	s.CollectingData = false
	s.DataLines = []string{}
}

func (s *SMTPSession) GetFullMessage() string {
	return "From: " + s.MailFrom + "\nTo: " + s.RcptTo + "\n" + stringJoin(s.DataLines, "\r\n")
}

func stringJoin(lines []string, sep string) string {
	out := ""
	for i, l := range lines {
		if i > 0 {
			out += sep
		}
		out += l
	}
	return out
}
