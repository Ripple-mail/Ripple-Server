CC = gcc
CFLAGS = -Wall -Wextra -std=c11 -O2

TARGET = ripple_server

SOURCES = src/main.c

all: $(TARGET)

$(TARGET): $(SOURCES)
	$(CC) $(CFLAGS) -o $(TARGET) $(SOURCES)

clean:
	rm -f $(TARGET)

.PHONY: all clean
