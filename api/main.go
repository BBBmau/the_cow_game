package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	defaultPort     = "8080"
	defaultLimit    = 100
	leaderboardTable = "leaderboard"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}

	pool, err := newPool()
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()

	if err := ensureLeaderboardTable(context.Background(), pool); err != nil {
		log.Fatalf("ensure table: %v", err)
	}

	// Debug: log which DB we're using and how many rows are in the leaderboard table
	logDBConnection()
	if n, err := leaderboardRowCount(context.Background(), pool); err != nil {
		log.Printf("debug: leaderboard row count: %v", err)
	} else {
		log.Printf("debug: leaderboard table has %d row(s) (empty = nothing writes to this table yet)", n)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/api/leaderboard", cors(leaderboardHandler(pool)))

	addr := ":" + port
	log.Printf("API server listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("serve: %v", err)
	}
}

func newPool() (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(dbURL())
	if err != nil {
		return nil, err
	}
	cfg.MaxConns = 10
	cfg.MaxConnLifetime = time.Hour
	return pgxpool.NewWithConfig(context.Background(), cfg)
}

func dbURL() string {
	if u := os.Getenv("DATABASE_URL"); u != "" {
		return u
	}
	host := getEnv("POSTGRES_HOST", "127.0.0.1")
	port := getEnv("POSTGRES_PORT", "5432")
	user := getEnv("POSTGRES_USER", "postgres")
	pass := getEnv("POSTGRES_PASSWORD", "")
	db := getEnv("POSTGRES_DB", "cow_game")
	ssl := "disable"
	if os.Getenv("POSTGRES_SSL") == "true" {
		ssl = "require"
	}
	return "postgres://" + user + ":" + pass + "@" + host + ":" + port + "/" + db + "?sslmode=" + ssl
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// redactPassword hides the password in a postgres URL for safe logging.
func redactPassword(u string) string {
	// postgres://user:password@host:port/db?sslmode=...
	re := regexp.MustCompile(`^([^:]+://[^:]+:)([^@]+)(@.+)$`)
	return re.ReplaceAllString(u, "$1***$3")
}

func logDBConnection() {
	u := dbURL()
	log.Printf("debug: database %s", redactPassword(u))
}

func leaderboardRowCount(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	var n int
	err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM `+leaderboardTable).Scan(&n)
	return n, err
}

func ensureLeaderboardTable(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS `+leaderboardTable+` (
			username TEXT PRIMARY KEY,
			level INTEGER NOT NULL DEFAULT 1,
			experience INTEGER NOT NULL DEFAULT 0,
			hay_eaten INTEGER NOT NULL DEFAULT 0,
			updated_at BIGINT NOT NULL DEFAULT 0
		)
	`)
	return err
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":    "ok",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

type leaderboardEntry struct {
	Username   string `json:"username"`
	Level      int    `json:"level"`
	Experience int    `json:"experience"`
	HayEaten   int    `json:"hayEaten"`
}

func leaderboardHandler(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		limit := defaultLimit
		if s := r.URL.Query().Get("limit"); s != "" {
			if n, err := strconv.Atoi(s); err == nil && n > 0 && n <= 500 {
				limit = n
			}
		}
		entries, err := fetchLeaderboard(r.Context(), pool, limit)
		if err != nil {
			log.Printf("leaderboard query: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
		log.Printf("debug: GET /api/leaderboard limit=%d -> %d entries", limit, len(entries))
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"entries": entries,
		})
	}
}

func fetchLeaderboard(ctx context.Context, pool *pgxpool.Pool, limit int) ([]leaderboardEntry, error) {
	rows, err := pool.Query(ctx, `
		SELECT username, level, experience, hay_eaten
		FROM `+leaderboardTable+`
		ORDER BY experience DESC, hay_eaten DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []leaderboardEntry
	for rows.Next() {
		var e leaderboardEntry
		if err := rows.Scan(&e.Username, &e.Level, &e.Experience, &e.HayEaten); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func cors(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}
