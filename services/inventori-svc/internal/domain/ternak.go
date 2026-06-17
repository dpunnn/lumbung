package domain

import (
	"time"

	"github.com/google/uuid"
)

type Ternak struct {
	ID                 uuid.UUID
	KoperasiID         uuid.UUID
	Kode               string
	Jenis              string
	UmurBulan          *int
	Status             string
	VaksinTerakhir     *time.Time
	NilaiEstimasi      int64
	FotoURL            *string
	JumlahKlaim        int
	JumlahTerverifikasi int
	Terverifikasi      bool
	TanggalMati        *time.Time
	DicatatMatiOleh    *uuid.UUID
	CreatedAt          time.Time
}
